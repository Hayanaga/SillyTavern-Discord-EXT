// Search in the open chat, as Discord's header search: type and press Enter, and the results
// open in a panel on the right (newest or oldest first), each with the words found marked
// and a Jump button that scrolls to the message (loading older messages if needed, through
// SillyTavern's /chat-jump). "from:name" keeps one speaker's messages. Ctrl/⌘+F goes to the box.

import { monogramizeAll } from './monograms.js';
import { escapeHtml, iconButton, shieldFromOutsideClose, t } from './ui.js';
import { listen, onEvent } from './life.js';

const PANEL_ID = 'dsc-search';
const MAX_RESULTS = 200;

let input = /** @type {HTMLInputElement|null} */ (null);
let order = 'newest';
let lastQuery = '';

/** Splits "from:Lyra dragon eggs" into the speaker and the words. */
function parseQuery(query) {
    let from = '';
    const words = [];
    for (const match of String(query).matchAll(/(from:)?(?:"([^"]+)"|(\S+))/gi)) {
        const value = (match[2] ?? match[3] ?? '').trim();
        if (!value) {
            continue;
        }
        if (match[1]) {
            from = value;
        } else {
            words.push(value);
        }
    }
    return { from, words };
}

/** The message as plain text, without markup. */
export function plainText(message) {
    const div = document.createElement('div');
    div.innerHTML = SillyTavern.libs.DOMPurify.sanitize(String(message.extra?.display_text || message.mes || ''), { ALLOWED_TAGS: [] });
    // markdown marks aren't words: **bold**, _italics_, ~~struck~~, `code`, # headings, ||spoilers||
    return (div.textContent || '')
        .replace(/(\*\*|__|~~|\|\||`+)/g, '')
        .replace(/(^|\s)[*_](?=\S)/g, '$1')
        .replace(/(\S)[*_](?=\s|$|[.,!?;:)"'])/g, '$1')
        .replace(/(^|\n)#{1,6}\s+/g, '$1')
        .replace(/\s+/g, ' ').trim();
}

/** Messages of the open chat that have every word (and match from:), as [index, text]. */
function findMessages(chat, query) {
    const { from, words } = parseQuery(query);
    const lowered = words.map(word => word.toLowerCase());
    const found = [];
    chat.forEach((message, index) => {
        if (!message || (from && !String(message.name ?? '').toLowerCase().includes(from.toLowerCase()))) {
            return;
        }
        const text = plainText(message);
        const haystack = text.toLowerCase();
        if (lowered.every(word => haystack.includes(word)) && (lowered.length || from)) {
            found.push({ index, text });
        }
    });
    return found;
}

/** A short piece of the text around the first word found, with the words marked. */
function snippet(text, words, size = 240) {
    const lowered = text.toLowerCase();
    const first = Math.min(...words.map(word => lowered.indexOf(word.toLowerCase())).filter(x => x >= 0), Infinity);
    let start = Number.isFinite(first) ? Math.max(0, first - Math.floor(size / 3)) : 0;
    if (start > 0) {
        const space = text.indexOf(' ', start);
        start = space > 0 && space < first ? space + 1 : start;
    }
    let piece = text.slice(start, start + size);
    const cut = start + size < text.length;
    let html = escapeHtml(piece);
    const pattern = words.filter(Boolean).map(word => escapeHtml(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    if (pattern) {
        html = html.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
    }
    return `${start > 0 ? '…' : ''}${html}${cut ? '…' : ''}`;
}

function closeResults() {
    document.getElementById(PANEL_ID)?.remove();
    document.body.classList.remove('dsc-search-open');
}

/** The picture beside a result: the speaker's own. */
export function avatarFor(message) {
    const { getThumbnailUrl, characters } = SillyTavern.getContext();
    if (message.is_user) {
        return message.force_avatar || document.querySelector('#chat .mes[is_user="true"] .avatar img')?.getAttribute('src') || '';
    }
    const character = message.original_avatar
        ? characters.find(x => x.avatar === message.original_avatar)
        : characters.find(x => x.name === message.name);
    return message.force_avatar || (character ? getThumbnailUrl('avatar', character.avatar) : '');
}

export async function jump(index) {
    const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
    if (window.matchMedia('(max-width: 1100px)').matches) {
        closeResults();
    }
    await executeSlashCommandsWithOptions(`/chat-jump ${Number(index)}`);
    const mes = document.querySelector(`#chat > .mes[mesid="${Number(index)}"]`);
    mes?.classList.add('dsc-found');
    setTimeout(() => mes?.classList.remove('dsc-found'), 2400);
}

function render(query) {
    const { chat, timestampToMoment } = SillyTavern.getContext();
    const { words } = parseQuery(query);
    let found = findMessages(chat, query);
    if (order === 'newest') {
        found = found.reverse();
    }
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
        panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.setAttribute('aria-label', t('Search Results'));
        shieldFromOutsideClose(panel);
        document.body.append(panel);
    }
    const head = document.createElement('div');
    head.className = 'dsc-search-head';
    const count = document.createElement('h2');
    count.textContent = found.length === 1 ? t('1 Result') : `${found.length.toLocaleString()} ${t('Results')}`;
    const tabs = document.createElement('div');
    tabs.className = 'dsc-search-tabs';
    for (const [value, label] of [['newest', 'Newest'], ['oldest', 'Oldest']]) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.textContent = t(label);
        tab.classList.toggle('dsc-selected', order === value);
        tab.addEventListener('click', () => {
            order = value;
            render(query);
        });
        tabs.append(tab);
    }
    const close = iconButton('dsc-search-close', t('Close'), 'close', 18);
    close.addEventListener('click', () => {
        closeResults();
        if (input) {
            input.value = '';
        }
    });
    head.append(count, tabs, close);

    const list = document.createElement('div');
    list.className = 'dsc-search-list';
    if (!found.length) {
        const empty = document.createElement('div');
        empty.className = 'dsc-search-empty';
        empty.textContent = t('No results. Try other words, or from:name.');
        list.append(empty);
    }
    for (const { index, text } of found.slice(0, MAX_RESULTS)) {
        const message = chat[index];
        const row = document.createElement('article');
        row.className = 'dsc-search-result';
        const picture = document.createElement('span');
        picture.className = 'dsc-avatar';
        picture.dataset.name = message.name ?? '';
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.src = avatarFor(message);
        picture.append(img);
        const body = document.createElement('div');
        body.className = 'dsc-search-body';
        const top = document.createElement('div');
        top.className = 'dsc-search-top';
        const name = document.createElement('span');
        name.className = 'dsc-search-name';
        name.textContent = message.name ?? '';
        const when = document.createElement('time');
        const sent = message.send_date ? timestampToMoment(message.send_date) : null;
        when.textContent = sent?.isValid?.() ? sent.format('l LT') : '';
        top.append(name, when);
        const words_ = document.createElement('div');
        words_.className = 'dsc-search-text';
        words_.innerHTML = snippet(text, words);
        body.append(top, words_);
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'dsc-search-jump';
        go.textContent = t('Jump');
        go.addEventListener('click', () => jump(index));
        row.addEventListener('click', (event) => {
            if (event.target !== go) {
                jump(index);
            }
        });
        row.append(picture, body, go);
        list.append(row);
    }
    if (found.length > MAX_RESULTS) {
        const more = document.createElement('div');
        more.className = 'dsc-search-empty';
        more.textContent = t('Showing the first {0}. Add words to narrow it down.').replace('{0}', String(MAX_RESULTS));
        list.append(more);
    }
    panel.replaceChildren(head, list);
    document.body.classList.add('dsc-search-open');
    monogramizeAll(panel, '.dsc-avatar img', img => img.parentElement?.dataset.name ?? '');
}

/** Runs a search in the open chat. */
function searchChat(query) {
    lastQuery = String(query ?? '').trim();
    if (!lastQuery) {
        closeResults();
        return;
    }
    render(lastQuery);
}

/** Puts the cursor in the header's search box. */
function focusSearch() {
    input?.focus();
    input?.select();
}

/** Whether Ctrl/⌘+F means this chat's search. Anywhere else, and from the box itself, the browser's own find opens. */
function searchesChat() {
    const focused = document.activeElement;
    if (focused === input || (focused?.matches('input, textarea, [contenteditable="true"]') && focused.id !== 'send_textarea')) {
        return false;
    }
    return !document.querySelector('.dsc-open, .openDrawer, #character_popup[style*="flex"], dialog.popup[open]')
        && !/\bdsc-settings-(open|list|page)\b/.test(document.body.className);
}

/**
 * @param {HTMLInputElement} box The header's search box
 */
export function initSearch(box) {
    input = box;
    box.readOnly = false;
    box.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.isComposing) {
            event.preventDefault();
            searchChat(box.value);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            box.value = '';
            box.blur();
            closeResults();
        }
    });
    listen(document, 'keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f'
            && document.body.classList.contains('discord-theme') && SillyTavern.getContext().chat.length
            && searchesChat()) {
            event.preventDefault();
            focusSearch();
        }
        if (event.key === 'Escape' && document.getElementById(PANEL_ID) && document.activeElement !== box
            && !document.querySelector('dialog.popup[open], #dsc-popout, #dsc-viewer')) {
            closeResults();
        }
    });
    const { eventTypes } = SillyTavern.getContext();
    onEvent(eventTypes.CHAT_CHANGED, () => {
        closeResults();
        box.value = '';
    });
    // new messages keep open results current
    for (const type of [eventTypes.MESSAGE_RECEIVED, eventTypes.MESSAGE_SENT, eventTypes.MESSAGE_DELETED, eventTypes.MESSAGE_EDITED]) {
        onEvent(type, () => document.getElementById(PANEL_ID) && lastQuery && render(lastQuery));
    }
}
