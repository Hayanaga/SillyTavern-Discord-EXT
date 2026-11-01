// Where the conversations come from: SillyTavern's recent chats (the same list as its welcome
// screen) become direct messages, and its groups become servers whose chats are channels.
// Also opens a chat from any of those places.

import { isChatSaving } from '../../../../script.js';
import { imagesLabel } from './lib/image-links.js';
import { t } from './ui.js';
import { onEvent } from './life.js';

/** SillyTavern's own pinned chats, kept in account storage by welcome-screen.js */
const PINNED_KEY = 'pinnedChats';

let getMax = () => 50;
/** @type {Array<object>} */
let recent = [];
let requestId = 0;
let refreshTimer = 0;
const listeners = new Set();

/** Calls back whenever the conversation lists change. */
export function onDataChange(listener) {
    listeners.add(listener);
}

function emit() {
    for (const listener of listeners) {
        try {
            listener();
        } catch (error) {
            console.error('[Discord] list update failed', error);
        }
    }
}

function getPinState() {
    try {
        return JSON.parse(SillyTavern.getContext().accountStorage.getItem(PINNED_KEY) || '{}') || {};
    } catch {
        return {};
    }
}

/** SillyTavern's key for a pinned chat (welcome-screen.js) */
function pinKey({ group, avatar, fileName }) {
    return `${group ? 'group_' + group : ''}${avatar ? 'char_' + avatar : ''}_${fileName}`;
}

export function isPinned(place) {
    return !!place && Object.hasOwn(getPinState(), pinKey(place));
}

/** Pins a chat (SillyTavern's pinned chats), or unpins it. */
export function togglePin(place) {
    if (!place) {
        return;
    }
    const state = getPinState();
    const key = pinKey(place);
    if (Object.hasOwn(state, key)) {
        delete state[key];
    } else {
        state[key] = { group: place.group || undefined, avatar: place.avatar || undefined, file_name: place.fileName };
    }
    SillyTavern.getContext().accountStorage.setItem(PINNED_KEY, JSON.stringify(state));
    refreshData();
}

/** Plain one-line preview of a message, without markup; "Image" for a picture-only message. */
function toPreview(text) {
    const pictures = imagesLabel(text);
    if (pictures) {
        return t(pictures);
    }
    const div = document.createElement('div');
    div.innerHTML = SillyTavern.libs.DOMPurify.sanitize(String(text ?? ''), { ALLOWED_TAGS: [] });
    return (div.textContent || '').replace(/[*_~`#>]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
}

/** A group's chat name without the "<group> - " SillyTavern puts in front. */
export function channelLabel(group, chatId) {
    const prefix = `${group.name} - `;
    return chatId.startsWith(prefix) ? chatId.slice(prefix.length) : chatId;
}

async function refreshData() {
    const context = SillyTavern.getContext();
    const id = ++requestId;
    let data = [];
    try {
        const response = await fetch('/api/chats/recent', {
            method: 'POST',
            headers: context.getRequestHeaders(),
            body: JSON.stringify({ max: getMax(), pinned: Object.values(getPinState()) }),
            cache: 'no-cache',
        });
        if (response.ok) {
            data = await response.json();
        }
    } catch (error) {
        console.warn('[Discord] Could not load recent chats', error);
    }
    if (id !== requestId || !Array.isArray(data)) {
        return;
    }
    recent = data.map((chat) => {
        const fileId = String(chat.file_name || '').replace(/\.jsonl$/, '');
        return {
            avatar: chat.avatar || '',
            group: chat.group || '',
            fileId,
            fileName: chat.file_name,
            preview: toPreview(chat.mes),
            lastMes: Number(chat.last_mes) || 0,
        };
    });
    emit();
}

/** Refreshes after a pause, so a burst of events costs one request. */
export function scheduleRefresh(delay = 600) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshData, delay);
}

/**
 * Direct messages: one row per character, its latest chat first; pinned chats lead.
 * @returns {Array<{character: object, avatar: string, fileId: string, fileName: string, preview: string, lastMes: number, pinned: boolean}>}
 */
export function getDirectMessages() {
    const { characters } = SillyTavern.getContext();
    const seen = new Set();
    const rows = [];
    for (const chat of recent) {
        if (chat.group || !chat.avatar || seen.has(chat.avatar)) {
            continue;
        }
        const character = characters.find(x => x.avatar === chat.avatar);
        if (!character) {
            continue;
        }
        seen.add(chat.avatar);
        rows.push({ ...chat, character, pinned: isPinned(chat) });
    }
    // the open chat's character is always listed, as Discord keeps an open DM in the list
    const current = getCurrentPlace();
    if (current && !current.group && !seen.has(current.avatar)) {
        const character = characters.find(x => x.avatar === current.avatar);
        if (character) {
            rows.unshift({ ...current, preview: '', lastMes: Date.now(), character, pinned: isPinned(current) });
        }
    }
    return rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastMes - a.lastMes);
}

/** Servers: SillyTavern's groups, in their own order. */
export function getServers() {
    return [...SillyTavern.getContext().groups];
}

export function getGroup(groupId) {
    return SillyTavern.getContext().groups.find(x => String(x.id) === String(groupId)) ?? null;
}

/** Channels: a group's chats, oldest first, as a server keeps its channel order. */
export function getChannels(group) {
    const chats = Array.isArray(group?.chats) ? group.chats : [];
    return chats.map(chatId => ({ group: String(group.id), avatar: '', fileId: chatId, fileName: `${chatId}.jsonl`, name: channelLabel(group, chatId) }));
}

/** The newest chat of a group, by SillyTavern's own record of it. */
export function latestChannel(group) {
    if (!group) {
        return null;
    }
    const chats = getChannels(group);
    if (group.chat_id && chats.some(x => x.fileId === group.chat_id)) {
        return chats.find(x => x.fileId === group.chat_id);
    }
    return chats[chats.length - 1] ?? null;
}

/** Where the open chat is: { group, avatar, fileId, fileName } */
export function getCurrentPlace() {
    const context = SillyTavern.getContext();
    const fileId = context.getCurrentChatId();
    if (!fileId) {
        return null;
    }
    if (context.groupId) {
        return { group: String(context.groupId), avatar: '', fileId, fileName: `${fileId}.jsonl` };
    }
    const character = context.characters[context.characterId];
    return character ? { group: '', avatar: character.avatar, fileId, fileName: `${fileId}.jsonl` } : null;
}

export function isCurrent(place) {
    const current = getCurrentPlace();
    return !!current && !!place && current.fileId === place.fileId
        && String(current.group || '') === String(place.group || '')
        && (place.group ? true : current.avatar === place.avatar);
}

let onOpened = () => {};

/** Opens a group by clicking a stand-in for its card, which reaches SillyTavern's own handlers. */
async function selectGroup(groupId) {
    const context = SillyTavern.getContext();
    if (String(context.groupId) === String(groupId)) {
        return;
    }
    const card = document.createElement('div');
    card.className = 'group_select dsc-hidden-card';
    card.setAttribute('data-grid', groupId);
    document.body.append(card);
    const changed = new Promise((resolve) => {
        context.eventSource.once(context.eventTypes.CHAT_CHANGED, resolve);
        setTimeout(resolve, 5000);
    });
    card.click();
    card.remove();
    await changed;
}

/** Resolves once SillyTavern has finished saving, since it refuses to switch chats until then. */
async function whenSaved() {
    for (let i = 0; isChatSaving && i < 200; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

/** Counts chat openings, so that only the latest click goes ahead after a wait */
let opening = 0;

/** Opens a chat: a character's (a direct message) or a group's (a channel). */
export async function openPlace(place) {
    const context = SillyTavern.getContext();
    if (!place) {
        return;
    }
    if (isCurrent(place)) {
        onOpened();
        return;
    }
    const ticket = ++opening;
    try {
        await whenSaved();
        if (ticket !== opening) {
            return;
        }
        if (place.group) {
            if (!getGroup(place.group)) {
                return;
            }
            await selectGroup(place.group);
            if (place.fileId && SillyTavern.getContext().getCurrentChatId() !== place.fileId) {
                await context.openGroupChat(place.group, place.fileId);
            }
        } else {
            const characterId = context.characters.findIndex(x => x.avatar === place.avatar);
            if (characterId === -1) {
                return;
            }
            if (String(context.characterId) !== String(characterId) || context.groupId) {
                await context.selectCharacterById(characterId);
                // a save that began just then makes SillyTavern refuse once more
                if (String(SillyTavern.getContext().characterId) !== String(characterId)) {
                    await whenSaved();
                    if (ticket !== opening) {
                        return;
                    }
                    await context.selectCharacterById(characterId);
                }
            }
            // another click may have moved on: a file opened under the wrong character breaks that character's chat
            if (String(SillyTavern.getContext().characterId) !== String(characterId)) {
                return;
            }
            if (place.fileId && SillyTavern.getContext().getCurrentChatId() !== place.fileId) {
                await context.openCharacterChat(place.fileId);
            }
        }
        onOpened();
    } catch (error) {
        console.error('[Discord] Could not open the chat', error);
        toastr.error(t('Could not open that conversation. See the console for details.'));
    }
}

/** Opens a character's latest chat (their DM). */
export async function openCharacter(avatar) {
    const dm = getDirectMessages().find(x => x.avatar === avatar);
    await openPlace(dm ?? { group: '', avatar, fileId: '', fileName: '' });
}

/**
 * @param {object} options
 * @param {() => number} options.max How many recent chats to load
 * @param {() => void} options.opened Called once a chat is open
 * @returns {Promise<void>} Resolves once the first lists are in.
 */
export function initData({ max, opened }) {
    getMax = max;
    onOpened = opened;
    const { eventTypes } = SillyTavern.getContext();
    onEvent(eventTypes.CHAT_CHANGED, () => {
        emit();
        scheduleRefresh(300);
    });
    for (const type of [eventTypes.MESSAGE_SENT, eventTypes.MESSAGE_RECEIVED, eventTypes.MESSAGE_DELETED,
        eventTypes.CHAT_DELETED, eventTypes.GROUP_CHAT_DELETED, eventTypes.CHAT_CREATED, eventTypes.GROUP_CHAT_CREATED,
        eventTypes.CHAT_RENAMED, eventTypes.CHARACTER_DELETED, eventTypes.CHARACTER_RENAMED, eventTypes.GROUP_UPDATED,
        eventTypes.GROUP_CHAT_CREATED, eventTypes.CHARACTER_EDITED]) {
        if (type) {
            onEvent(type, () => scheduleRefresh());
        }
    }
    return refreshData();
}
