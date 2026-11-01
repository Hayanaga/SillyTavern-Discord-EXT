// Keeps the app's own name out of sight while the theme is on: the tab reads like a Discord
// tab with Discord's icon, and the message box says "Message @name" or
// "Message #channel". Turning the theme off puts the originals back.

import { channelLabel, getGroup } from './data.js';
import { t, toChannelName } from './ui.js';

const APP = 'Discord';
/** Discord's tab icon: the white mark on a blurple circle */
const ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'><circle cx=\'16\' cy=\'16\' r=\'16\' fill=\'#5865f2\'/><path transform=\'translate(6.5 6.5) scale(0.79)\' fill=\'#fff\' d=\'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z\'/></svg>')}`;
const PLACEHOLDER_ATTRS = ['placeholder', 'connected_text', 'no_connection_text'];

let original = null;
let active = false;
let unread = 0;
/** the App Icon picked, in place of the usual tab icon */
let appIcon = '';

/** Discord's tab icon with a red unread badge */
function badgedIcon() {
    return `data:image/svg+xml,${encodeURIComponent(decodeURIComponent(ICON.slice('data:image/svg+xml,'.length)).replace('</svg>', '<circle cx=\'24\' cy=\'24\' r=\'8\' fill=\'#f23f43\' stroke=\'#000\' stroke-opacity=\'.25\'/></svg>'))}`;
}

function setIcons(href) {
    for (const link of getIconLinks()) {
        link.setAttribute('href', appIcon || href);
        link.setAttribute('type', appIcon ? 'image/webp' : 'image/svg+xml');
    }
}

/** Puts an App Icon on the tab ('' for the usual icon). */
export function setAppIcon(href) {
    appIcon = href;
    if (active) {
        setIcons(unread ? badgedIcon() : ICON);
    }
}

/** "(n) Discord | …" and a badge on the tab icon while replies wait unread. */
export function setUnreadBadge(count) {
    unread = count;
    if (!active) {
        return;
    }
    setIcons(count ? badgedIcon() : ICON);
    refreshTitle();
}

function getIconLinks() {
    return [...document.querySelectorAll('link[rel~="icon"]')];
}

function remember() {
    if (original) {
        return;
    }
    const textarea = document.getElementById('send_textarea');
    original = {
        title: document.title,
        icons: getIconLinks().map(link => [link, link.getAttribute('href'), link.getAttribute('type')]),
        placeholder: Object.fromEntries(PLACEHOLDER_ATTRS.map(name => [name, textarea?.getAttribute(name)])),
    };
}

/** Where you are, the way Discord names it: "@Lyra", "#general" and its server, or Friends. */
function describe() {
    const context = SillyTavern.getContext();
    const group = context.groupId ? getGroup(context.groupId) : null;
    const character = !group && context.characterId !== undefined ? context.characters[context.characterId] : null;
    const chatId = context.getCurrentChatId();
    if (group && chatId) {
        return { title: [`#${toChannelName(channelLabel(group, chatId))}`, group.name], box: `#${toChannelName(channelLabel(group, chatId))}` };
    }
    if (character && chatId) {
        return { title: [`@${character.name}`], box: `@${character.name}` };
    }
    return { title: [t('Friends')], box: '' };
}

/** The tab title and message box text for where you are. */
export function refreshTitle() {
    if (!active) {
        return;
    }
    const where = describe();
    const body = document.body.classList;
    const page = body.contains('dsc-discover') ? [t('Discover')] : body.contains('dsc-friends') ? [t('Friends')] : where.title;
    document.title = `${unread ? `(${unread}) ` : ''}${[APP, ...page].join(' | ')}`;
    const textarea = document.getElementById('send_textarea');
    if (textarea) {
        const text = where.box ? `${t('Message')} ${where.box}` : t('Message');
        for (const name of PLACEHOLDER_ATTRS) {
            textarea.setAttribute(name, text);
        }
    }
}

export function setDisguise(enabled) {
    const textarea = document.getElementById('send_textarea');
    if (enabled) {
        remember();
        active = true;
        setIcons(unread ? badgedIcon() : ICON);
        refreshTitle();
        return;
    }
    if (!active || !original) {
        return;
    }
    active = false;
    document.title = original.title;
    for (const [link, href, type] of original.icons) {
        link.setAttribute('href', href);
        if (type) {
            link.setAttribute('type', type);
        } else {
            link.removeAttribute('type');
        }
    }
    if (textarea) {
        for (const name of PLACEHOLDER_ATTRS) {
            const value = original.placeholder[name];
            if (value === null || value === undefined) {
                textarea.removeAttribute(name);
            } else {
                textarea.setAttribute(name, value);
            }
        }
        // SillyTavern's own text for the current connection state
        const connected = !document.getElementById('send_form')?.classList.contains('no-connection');
        textarea.setAttribute('placeholder', textarea.getAttribute(connected ? 'connected_text' : 'no_connection_text') ?? '');
    }
    original = null;
}
