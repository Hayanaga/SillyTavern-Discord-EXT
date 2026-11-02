// Your own presence and the "you've got messages" side of Discord:
// - the user panel's picture opens a status menu (Online, Idle, Do Not Disturb, Invisible),
//   Edit Profile, and Switch Accounts (your personas);
// - replies that arrive while the window isn't in front count as unread: "(n) Discord" in the
//   tab, a red badge on the tab icon, the DM shown in bold, and (if you allowed it) a desktop
//   notification. Do Not Disturb keeps notifications and sounds quiet. Unread clears when you
//   come back.

import { canUseNicknames, openNicknames } from './lib/chat-nicknames.js';
import { setUnreadBadge } from './disguise.js';
import { imagesLabel } from './lib/image-links.js';
import { fullPictureUrl, openMenu, t } from './ui.js';
import { keyOfPicture, openLook } from './collectibles.js';
import { listen, onEvent } from './life.js';

const STATUSES = [
    { id: 'online', label: 'Online' },
    { id: 'idle', label: 'Idle' },
    { id: 'dnd', label: 'Do Not Disturb', note: 'You will not receive any desktop notifications.' },
    { id: 'invisible', label: 'Invisible', note: 'You will appear offline.' },
];

let getSettings = () => ({});
let save = () => {};
let openSettings = (_id) => {};
let unread = 0;
const unreadAvatars = new Set();

function watching() {
    return document.visibilityState === 'visible' && document.hasFocus();
}

/** Paints your dot and status line in the user panel. */
function refreshMyStatus() {
    const status = getSettings().myStatus || 'online';
    const panel = document.getElementById('dsc-user');
    const dot = /** @type {HTMLElement} */ (panel?.querySelector('.dsc-status'));
    if (dot) {
        dot.dataset.status = status === 'invisible' ? 'offline' : status;
    }
    const sub = panel?.querySelector('.dsc-user-sub');
    if (sub) {
        sub.textContent = t(STATUSES.find(x => x.id === status)?.label ?? 'Online');
    }
    document.body.classList.toggle('dsc-dnd', status === 'dnd');
}

function setMyStatus(id) {
    getSettings().myStatus = id;
    save();
    refreshMyStatus();
}

/** Switches to one of your personas, by SillyTavern's own command. */
async function switchAccount(name) {
    const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
    await executeSlashCommandsWithOptions(`/persona-set "${String(name).replace(/"/g, '\\"')}"`);
}

function openStatusMenu(anchor) {
    const status = getSettings().myStatus || 'online';
    const { powerUserSettings, name1 } = SillyTavern.getContext();
    const personas = Object.values(powerUserSettings?.personas ?? {}).filter(name => name && name !== name1);
    const items = STATUSES.map(item => ({
        label: item.label,
        note: item.note,
        dot: item.id === 'invisible' ? 'offline' : item.id,
        checked: status === item.id,
        run: () => setMyStatus(item.id),
    }));
    items.push('separator', { label: 'Edit Profile', icon: 'edit', run: () => openSettings('persona-management-button') });
    // your decoration, nameplate, effect and frame, as on a character's profile
    const key = keyOfPicture(anchor.querySelector('.dsc-avatar img')?.getAttribute('src') ?? '');
    if (key.startsWith('p:')) {
        items.push({ label: 'Change Look', icon: 'edit', run: () => openLook(key, name1, fullPictureUrl('persona', key.slice(2))) });
        if (canUseNicknames()) {
            items.push({ label: 'Nicknames', icon: 'edit', run: () => openNicknames() });
        }
    }
    if (personas.length) {
        items.push('separator', ...personas.slice(0, 8).map(name => ({ label: `${t('Switch to')} ${name}`, icon: 'user', run: () => switchAccount(name) })));
    }
    items.push({ label: 'Manage Accounts', icon: 'friends', run: () => openSettings('persona-management-button') });
    openMenu(anchor, items, 'right');
}

function markUnread(avatar) {
    unreadAvatars.add(avatar);
    document.querySelectorAll(`#dsc-side .dsc-dm[data-avatar="${CSS.escape(avatar)}"]`).forEach(row => row.classList.add('dsc-unread'));
}

function clearUnread() {
    if (!unread && !unreadAvatars.size) {
        return;
    }
    unread = 0;
    unreadAvatars.clear();
    document.querySelectorAll('#dsc-side .dsc-dm.dsc-unread').forEach(row => row.classList.remove('dsc-unread'));
    setUnreadBadge(0);
}

/** Re-marks unread DMs after the list is redrawn. */
export function repaintUnread() {
    for (const avatar of unreadAvatars) {
        markUnread(avatar);
    }
}

function notifyDesktop(message, character) {
    const settings = getSettings();
    if (!settings.desktopNotifications || settings.myStatus === 'dnd' || !('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    const { getThumbnailUrl } = SillyTavern.getContext();
    const pictures = imagesLabel(message?.mes);
    const body = pictures ? t(pictures) : String(message?.mes ?? '').replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
    try {
        const note = new Notification(character?.name ?? message?.name ?? 'Discord', {
            body,
            icon: character ? getThumbnailUrl('avatar', character.avatar) : undefined,
            tag: 'dsc-message',
        });
        note.onclick = () => {
            window.focus();
            note.close();
        };
    } catch {
        // some browsers only allow notifications from a service worker
    }
}

/** Asks the browser for permission to show desktop notifications (needs a click). */
export async function enableDesktopNotifications() {
    if (!('Notification' in window)) {
        toastr.warning(t('This browser has no desktop notifications.'));
        return false;
    }
    const result = await Notification.requestPermission();
    if (result !== 'granted') {
        toastr.warning(t('Desktop notifications are blocked for this site in the browser.'));
    }
    return result === 'granted';
}

/**
 * @param {object} options
 * @param {() => object} options.settings
 * @param {() => void} options.save
 * @param {(drawerId: string) => void} options.openSettings
 */
export function initNotify(options) {
    getSettings = options.settings;
    save = options.save;
    openSettings = options.openSettings;

    // your picture opens the status menu; Discord's Edit Profile lives in it
    const me = /** @type {HTMLElement} */ (document.querySelector('#dsc-user .dsc-user-me'));
    if (me) {
        me.dataset.dscTip = t('Set Status');
        me.addEventListener('click', () => openStatusMenu(me));
    }
    refreshMyStatus();

    const { eventTypes } = SillyTavern.getContext();
    onEvent(eventTypes.CHARACTER_MESSAGE_RENDERED, (mesId, type) => {
        if (type === 'first_message' || watching() || !getSettings().enabled) {
            return;
        }
        const context = SillyTavern.getContext();
        const message = context.chat[Number(mesId)];
        const character = message?.original_avatar
            ? context.characters.find(x => x.avatar === message.original_avatar)
            : context.characters[context.characterId];
        unread++;
        if (character) {
            markUnread(character.avatar);
        }
        setUnreadBadge(unread);
        notifyDesktop(message, character);
    });
    listen(window, 'focus', clearUnread);
    listen(document, 'visibilitychange', () => {
        if (watching()) {
            clearUnread();
        }
    });
}
