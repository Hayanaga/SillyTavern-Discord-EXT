// Small shared parts: icons, buttons, Discord's black tooltips, its context menus, and the
// helpers that drive SillyTavern's own menus.

import { listen } from './life.js';

let cachedContext = null;

/** SillyTavern's context, built once per task: getContext() builds a large object on every call,
    which adds up when it's called for each message of a long chat. */
export function context() {
    if (!cachedContext) {
        cachedContext = SillyTavern.getContext();
        queueMicrotask(() => {
            cachedContext = null;
        });
    }
    return cachedContext;
}

const processed = new WeakMap();

/** Whether a message's text was already drawn by the theme for this key and SillyTavern hasn't
    redrawn it since (its first and last nodes are still the ones the theme left). Skipping those
    keeps long chats quick: every rewrite wakes SillyTavern's own page watchers. */
export function alreadyDone(element, key) {
    const seen = processed.get(element);
    return !!seen && seen.keys.has(key) && seen.first === element.firstChild && seen.last === element.lastChild;
}

/** Records that one pass (its own key: splitting, pictures…) is done for the text as it stands.
    Passes are kept apart, so one finishing never makes another think it's done too. */
export function markDone(element, key) {
    const seen = processed.get(element);
    if (seen && seen.first === element.firstChild && seen.last === element.lastChild) {
        seen.keys.add(key);
    } else {
        processed.set(element, { keys: new Set([key]), first: element.firstChild, last: element.lastChild });
    }
}

/** The chat message behind a message element. */
export function messageOf(mes) {
    return context().chat[Number(mes?.getAttribute('mesid'))];
}

export function t(text) {
    return SillyTavern.getContext().translate(text);
}

/** Translates a block of the theme's own HTML (the Extensions panel): its words, placeholders
    and titles, each looked up as written. */
export function translateTree(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }
    for (const node of nodes) {
        const text = node.nodeValue.replace(/\s+/g, ' ').trim();
        if (text && /[A-Za-z]/.test(text)) {
            const translated = t(text);
            if (translated !== text) {
                node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), translated);
            }
        }
    }
    for (const element of root.querySelectorAll('[placeholder], [title]')) {
        for (const name of ['placeholder', 'title']) {
            const value = element.getAttribute(name);
            if (value) {
                element.setAttribute(name, t(value));
            }
        }
    }
}

const MOBILE_QUERY = '(max-width: 1000px)';

export function isPhone() {
    return window.matchMedia(MOBILE_QUERY).matches;
}

/** An icon from tokens.css (--dsc-i-<name>). */
export function icon(name, size = 24) {
    const glyph = document.createElement('i');
    glyph.className = 'dsc-ico';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.style.setProperty('--dsc-icon-url', `var(--dsc-i-${name})`);
    if (size !== 24) {
        glyph.style.width = glyph.style.height = `${size}px`;
    }
    return glyph;
}

/** An icon-only button with a Discord tooltip. */
export function iconButton(className, label, iconName, size = 24) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.setAttribute('aria-label', label);
    element.dataset.dscTip = label;
    element.append(icon(iconName, size));
    return element;
}

/** Clicks a SillyTavern drawer's toggle, the way its own top bar does. */
function toggleDrawer(drawerId) {
    // straight to SillyTavern's handler for Characters: an extension can catch clicks on that hidden
    // button and open a menu of its own under it, off screen (Character Library's launcher)
    if (drawerId === 'rightNavHolder') {
        $(`#${drawerId} > .drawer-toggle`).triggerHandler('click');
        return;
    }
    document.querySelector(`#${drawerId} > .drawer-toggle`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

export function isDrawerOpen(drawerId) {
    return !!document.querySelector(`#${drawerId} > .drawer-content.openDrawer`);
}

/** Opens a drawer unless it's open already. */
export function openDrawer(drawerId) {
    if (!isDrawerOpen(drawerId)) {
        toggleDrawer(drawerId);
    }
}

/** Closes every open drawer (pinned ones get unpinned: Discord has no pinned panels). */
export function closeDrawers(except = '') {
    for (const content of document.querySelectorAll('#top-settings-holder .drawer-content.openDrawer')) {
        const drawer = content.closest('.drawer');
        if (!drawer?.id || drawer.id === except) {
            continue;
        }
        if (content.classList.contains('pinnedOpen')) {
            /** @type {HTMLInputElement} */ (content.querySelector('input[id$="_panel_pin"]'))?.click();
        }
        toggleDrawer(drawer.id);
    }
}

/** Clicks an entry of SillyTavern's chat options menu (the ☰ by the message box). */
export function clickOption(id) {
    const options = [...document.querySelectorAll(`#options #${id}`)];
    (options.find(x => !x.classList.contains('displayNone')) ?? options[0])?.click();
}

/** Discord's acronym for a name without a picture: first letters of the words, at most three. */
export function getAcronym(name) {
    const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
        return '?';
    }
    return words.slice(0, 3).map(word => [...word][0] ?? '').join('');
}

export function getInitials(name) {
    const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
        return '?';
    }
    const first = [...words[0]][0] ?? '';
    const last = words.length > 1 ? [...words[words.length - 1]][0] ?? '' : '';
    return (first + last).toUpperCase();
}

/**
 * The full-size picture of a character ('avatar') or persona ('persona'). SillyTavern's
 * thumbnails are 96×144, which blur anywhere a picture is drawn larger than about 48px on a
 * high-density screen, so profiles and banners use the original.
 */
export function fullPictureUrl(type, file) {
    return `${type === 'persona' ? 'User Avatars' : 'characters'}/${encodeURIComponent(file)}`;
}

/**
 * A server's picture: the group's own picture if it has one, otherwise up to four of its
 * members side by side, as the Yodayo theme's group cards do. null when it has neither,
 * so the caller falls back to the acronym.
 */
export function serverPicture(group) {
    const { characters, getThumbnailUrl } = SillyTavern.getContext();
    if (group?.avatar_url && !String(group.avatar_url).includes('img/')) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = group.avatar_url;
        img.loading = 'lazy';
        return img;
    }
    const known = new Set(characters.map(character => character.avatar));
    const members = (group?.members ?? []).filter(avatar => known.has(avatar)).slice(0, 4);
    if (!members.length) {
        return null;
    }
    const collage = document.createElement('span');
    collage.className = `dsc-collage dsc-collage-${members.length}`;
    for (const avatar of members) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = getThumbnailUrl('avatar', avatar);
        img.loading = 'lazy';
        img.draggable = false;
        collage.append(img);
    }
    return collage;
}

/** Discord's default avatar colors; a name always gets the same one */
const AVATAR_COLORS = 6;

export function getColorIndex(name) {
    let hash = 0;
    for (const char of String(name ?? '')) {
        hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    }
    return hash % AVATAR_COLORS;
}

/** A Discord default avatar: a colored circle with initials. */
export function monogram(name, className = '') {
    const element = document.createElement('span');
    element.className = `dsc-monogram ${className}`.trim();
    element.textContent = getInitials(name);
    element.dataset.dscColor = String(getColorIndex(name));
    element.setAttribute('aria-hidden', 'true');
    return element;
}

/** "Lyra Moon" → "lyramoon", like a Discord username */
export function toUsername(name) {
    return String(name ?? '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}._]+/gu, '').slice(0, 32) || 'user';
}

/** "Morning Chat" → "morning-chat", like a Discord channel name */
export function toChannelName(name) {
    return String(name ?? '').trim().toLowerCase().replace(/\s+/g, '-');
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
}

/* Tooltips: Discord's black label with an arrow, beside or above whatever has data-dsc-tip.
   One listener for the whole page; data-dsc-tip-side picks right, bottom or top (default). */

let tip = null;
let tipTarget = null;

function getTip() {
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'dsc-tooltip';
        tip.setAttribute('role', 'tooltip');
        tip.hidden = true;
        document.body.append(tip);
    }
    return tip;
}

function hideTooltip() {
    if (tip) {
        tip.hidden = true;
    }
    tipTarget = null;
}

function showTooltip(target) {
    const text = target.dataset.dscTip;
    if (!text || !document.body.classList.contains('discord-theme') || isPhone()) {
        return;
    }
    const element = getTip();
    tipTarget = target;
    element.textContent = text;
    const side = target.dataset.dscTipSide || 'top';
    element.dataset.side = side;
    element.hidden = false;
    const box = target.getBoundingClientRect();
    const own = element.getBoundingClientRect();
    let left;
    let top;
    if (side === 'right') {
        left = box.right + 12;
        top = box.top + box.height / 2 - own.height / 2;
    } else if (side === 'bottom') {
        left = box.left + box.width / 2 - own.width / 2;
        top = box.bottom + 8;
    } else {
        left = box.left + box.width / 2 - own.width / 2;
        top = box.top - own.height - 8;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - own.width - 8));
    element.style.left = `${Math.round(left)}px`;
    element.style.top = `${Math.round(Math.max(8, top))}px`;
}

/**
 * SillyTavern closes every open menu on a mouse or touch press anywhere outside it. The
 * theme's own layers (the settings and editor frames, menus, the quick switcher) sit
 * outside SillyTavern's menus while holding them, so presses there stay with the theme.
 */
export function shieldFromOutsideClose(element) {
    for (const type of ['mousedown', 'touchstart']) {
        element?.addEventListener(type, event => event.stopPropagation(), { passive: true });
    }
}

export function initTooltips() {
    listen(document, 'pointerover', (event) => {
        const target = /** @type {HTMLElement} */ (event.target).closest?.('[data-dsc-tip]');
        if (target === tipTarget) {
            return;
        }
        hideTooltip();
        if (target && event.pointerType !== 'touch') {
            showTooltip(/** @type {HTMLElement} */ (target));
        }
    });
    listen(document, 'pointerdown', hideTooltip, true);
    listen(window, 'blur', hideTooltip);
    listen(document, 'scroll', hideTooltip, true);
}

/* Context menus: Discord's dark floating menu, opened by a button or a right click */

const MENU_ID = 'dsc-menu';
let menuAnchor = null;

function closeMenu() {
    const menu = document.getElementById(MENU_ID);
    if (menu) {
        menu.hidden = true;
    }
    menuAnchor?.classList.remove('dsc-menu-open');
    menuAnchor = null;
}

function getMenu() {
    let menu = document.getElementById(MENU_ID);
    if (menu) {
        return menu;
    }
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    document.body.append(menu);
    shieldFromOutsideClose(menu);
    listen(document, 'pointerdown', (event) => {
        const target = /** @type {Node} */ (event.target);
        if (!menu.hidden && !menu.contains(target) && !menuAnchor?.contains(target)) {
            closeMenu();
        }
    });
    listen(document, 'keydown', (event) => {
        if (event.key === 'Escape' && !menu.hidden) {
            event.stopPropagation();
            closeMenu();
        }
    }, true);
    return menu;
}

/**
 * Opens a Discord menu at a button (or at the pointer for a right click); a second click on
 * the same button closes it.
 * @param {HTMLElement} anchor
 * @param {Array<{label: string, icon?: string, danger?: boolean, checked?: boolean, dot?: string, note?: string, run: () => void}|'separator'>} items
 * @param {{x: number, y: number}|'below'|'below-end'|'right'} [at]
 */
export function openMenu(anchor, items, at = 'below') {
    const menu = getMenu();
    if (!menu.hidden && menuAnchor === anchor) {
        closeMenu();
        return;
    }
    closeMenu();
    hideTooltip();
    menu.replaceChildren(...items.map((item) => {
        if (item === 'separator') {
            const line = document.createElement('div');
            line.className = 'dsc-menu-sep';
            return line;
        }
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'dsc-menu-item';
        row.setAttribute('role', 'menuitem');
        row.classList.toggle('dsc-menu-danger', !!item.danger);
        const label = document.createElement('span');
        label.className = 'dsc-menu-label';
        label.textContent = t(item.label);
        if (item.note) {
            const note = document.createElement('small');
            note.textContent = t(item.note);
            label.append(note);
        }
        if (item.color) {
            const swatch = document.createElement('span');
            swatch.className = 'dsc-menu-swatch';
            swatch.style.background = item.color;
            row.append(swatch);
        }
        if (item.dot) {
            // a status shape before the label, as in Discord's status menu
            const dot = document.createElement('span');
            dot.className = 'dsc-status dsc-menu-dot';
            dot.dataset.status = item.dot;
            row.classList.add('dsc-menu-status');
            row.append(dot);
        }
        row.append(label);
        if (item.checked !== undefined) {
            const box = document.createElement('span');
            box.className = 'dsc-menu-check';
            box.classList.toggle('dsc-on', !!item.checked);
            row.append(box);
        } else if (item.icon) {
            row.append(icon(item.icon, 18));
        }
        row.addEventListener('click', () => {
            closeMenu();
            item.run();
        });
        return row;
    }));
    menu.hidden = false;
    menuAnchor = anchor;
    anchor.classList.add('dsc-menu-open');
    const own = menu.getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    let left;
    let top;
    if (typeof at === 'object') {
        left = at.x;
        top = at.y;
    } else if (at === 'right') {
        left = box.right + 8;
        top = box.top;
    } else if (at === 'below-end') {
        left = box.right - own.width;
        top = box.bottom + 8;
    } else {
        left = box.left;
        top = box.bottom + 8;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - own.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - own.height - 8));
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    /** @type {HTMLElement} */ (menu.querySelector('.dsc-menu-item'))?.focus({ preventScroll: true });
}
