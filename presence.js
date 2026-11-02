// Presence: characters are online, idle, do-not-disturb or offline, as Discord shows people.
// Someone you talked with in the last quarter hour is online; within two hours idle (or, on
// some days, do-not-disturb); otherwise offline. Every status dot with data-dsc-presence
// (a character's avatar) shows it.
//
// Writing to someone who isn't online holds their reply: after a moment their dot turns
// online, then "X is typing…" shows while the reply is written. The hold happens inside
// SillyTavern's own awaited events (USER_MESSAGE_RENDERED for one-on-one chats,
// GROUP_MEMBER_DRAFTED per member in groups), so generation itself is untouched; swipes,
// regenerations and continues never wait.

import { nameFor } from './lib/chat-nicknames.js';
import { getDirectMessages, onDataChange } from './data.js';
import { play } from './sounds.js';
import { t } from './ui.js';
import { gated, GatedObserver, onEvent } from './life.js';

const STORE_KEY = 'dsc-presence-v1';
const ONLINE_MS = 15 * 60 * 1000;
const IDLE_MS = 2 * 60 * 60 * 1000;
const TYPING_ID = 'dsc-typing';

let options = {
    enabled: () => true,
    delay: () => 3,
    changed: () => {},
};

/** @type {Record<string, number>} last time each character was active (ms) */
let lastActive = {};

function load() {
    try {
        lastActive = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
    } catch {
        lastActive = {};
    }
}

function save() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(lastActive));
    } catch {
        // storage can be refused in private windows
    }
}

/** Marks a character active now (they wrote, or just came online). */
export function touch(avatar) {
    if (!avatar) {
        return;
    }
    lastActive[avatar] = Date.now();
    save();
    paintPresence();
    options.changed();
}

/** The latest activity known for a character: our record or their newest message. */
function activityOf(avatar) {
    const dm = getDirectMessages().find(x => x.avatar === avatar);
    return Math.max(lastActive[avatar] ?? 0, dm?.lastMes ?? 0);
}

function dayHash(avatar) {
    const day = Math.floor(Date.now() / 86400000);
    let hash = day;
    for (const char of String(avatar)) {
        hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    }
    return hash;
}

/** @returns {'online'|'idle'|'dnd'|'offline'} */
export function statusOf(avatar) {
    if (!options.enabled()) {
        return 'online';
    }
    const age = Date.now() - activityOf(avatar);
    if (age < ONLINE_MS) {
        return 'online';
    }
    if (age < IDLE_MS) {
        return dayHash(avatar) % 6 === 0 ? 'dnd' : 'idle';
    }
    return 'offline';
}

const STATUS_LABELS = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };

function statusLabel(avatar) {
    return t(STATUS_LABELS[statusOf(avatar)]);
}

/** Paints every status dot (and status text) under a root. */
export function paintPresence(root = document) {
    root.querySelectorAll('[data-dsc-presence]').forEach((element) => {
        const status = statusOf(/** @type {HTMLElement} */ (element).dataset.dscPresence);
        if (/** @type {HTMLElement} */ (element).dataset.status !== status) {
            /** @type {HTMLElement} */ (element).dataset.status = status;
        }
    });
    root.querySelectorAll('[data-dsc-presence-text]').forEach((element) => {
        element.textContent = statusLabel(/** @type {HTMLElement} */ (element).dataset.dscPresenceText);
    });
}

/* ---------- "X is typing…" under the message box ---------- */

function typingBar() {
    let bar = document.getElementById(TYPING_ID);
    if (!bar) {
        const form = document.getElementById('form_sheld');
        if (!form) {
            return null;
        }
        bar = document.createElement('div');
        bar.id = TYPING_ID;
        bar.setAttribute('aria-live', 'polite');
        form.append(bar);
    }
    return bar;
}

/** Who is typing right now, in the order they started */
const typing = new Set();

/** Discord's wording: "A is typing…", "A and B are typing…", "A, B, and C are typing…",
    "Several people are typing…". */
function drawTyping() {
    const bar = typingBar();
    if (!bar) {
        return;
    }
    const names = [...typing];
    if (!names.length) {
        bar.classList.remove('dsc-on');
        return;
    }
    const dots = document.createElement('span');
    dots.className = 'dsc-typing-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    const strong = (name) => {
        const element = document.createElement('strong');
        element.textContent = name;
        return element;
    };
    const text = document.createElement('span');
    text.className = 'dsc-typing-text';
    if (names.length > 3) {
        text.append(t('Several people are typing…'));
    } else if (names.length === 1) {
        text.append(strong(names[0]), ` ${t('is typing…')}`);
    } else if (names.length === 2) {
        text.append(strong(names[0]), ` ${t('and')} `, strong(names[1]), ` ${t('are typing…')}`);
    } else {
        text.append(strong(names[0]), ', ', strong(names[1]), `, ${t('and')} `, strong(names[2]), ` ${t('are typing…')}`);
    }
    bar.replaceChildren(dots, text);
    bar.classList.add('dsc-on');
}

export function showTyping(name) {
    typing.add(name);
    drawTyping();
}

export function hideTyping() {
    typing.clear();
    drawTyping();
    revealPending();
}

/* SillyTavern starts a streamed reply as an empty or "..." message; Discord shows only the
   typing line until the first words arrive, so that placeholder stays hidden until then. */

let pendingWatch = null;

function revealPending() {
    pendingWatch?.disconnect();
    pendingWatch = null;
    document.querySelectorAll('#chat > .mes.dsc-pending').forEach(mes => mes.classList.remove('dsc-pending'));
}

function isPlaceholderText(mes) {
    const text = (mes.querySelector('.mes_text')?.textContent ?? '').trim();
    return text === '' || text === '...' || text === '…';
}

function watchForPlaceholder() {
    const chat = document.getElementById('chat');
    if (!chat || pendingWatch) {
        return;
    }
    const mark = () => {
        const last = chat.querySelector(':scope > .mes:last-of-type');
        if (last && last.getAttribute('is_user') !== 'true' && isPlaceholderText(last)) {
            last.classList.add('dsc-pending');
        }
    };
    pendingWatch = new GatedObserver(mark);
    pendingWatch.observe(chat, { childList: true });
    mark();
}

/* ---------- holding replies ---------- */

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Brings a character online if needed (waiting the set delay), then shows them typing. */
async function wake(avatar, name) {
    const away = options.enabled() && statusOf(avatar) !== 'online';
    if (away) {
        await delay(Math.max(0, Number(options.delay()) || 0) * 1000);
    }
    touch(avatar);
    if (away) {
        play('online');
    }
    showTyping(name);
}

/** A one-on-one reply of the normal kind is on its way (not a swipe, regenerate or continue) */
let pendingReply = false;
/** The kind of reply a group is producing */
let groupType = '';

export function initPresence(opts) {
    options = { ...options, ...opts };
    load();
    const { eventTypes } = SillyTavern.getContext();

    onEvent(eventTypes.GENERATION_STARTED, (type, params, dryRun) => {
        const context = SillyTavern.getContext();
        const normal = !dryRun && (type === undefined || type === 'normal') && !params?.quiet_prompt;
        pendingReply = normal && !context.groupId;
        // replies that don't wait show the typing line straight away
        if (!dryRun && type !== 'quiet' && type !== 'impersonate' && !pendingReply && !context.groupId) {
            const character = context.characters[context.characterId];
            if (character) {
                touch(character.avatar);
                showTyping(nameFor(character.avatar, character.name));
            }
        }
    });

    // one-on-one: the user's message is on screen; hold the reply here if they're away
    onEvent(eventTypes.USER_MESSAGE_RENDERED, async () => {
        const context = SillyTavern.getContext();
        if (!pendingReply || context.groupId) {
            return;
        }
        pendingReply = false;
        const character = context.characters[context.characterId];
        if (character) {
            await wake(character.avatar, character.name);
        }
    });

    // groups: each member in turn
    onEvent(eventTypes.GROUP_WRAPPER_STARTED, (data) => {
        groupType = data?.type ?? '';
    });
    onEvent(eventTypes.GROUP_MEMBER_DRAFTED, async (chId) => {
        const character = SillyTavern.getContext().characters[chId];
        if (!character) {
            return;
        }
        if (['swipe', 'regenerate', 'continue', 'impersonate', 'quiet'].includes(groupType)) {
            touch(character.avatar);
            showTyping(nameFor(character.avatar, character.name));
            return;
        }
        await wake(character.avatar, character.name);
    });

    onEvent(eventTypes.GENERATION_STARTED, (type, params, dryRun) => {
        if (!dryRun && type !== 'quiet' && type !== 'impersonate') {
            watchForPlaceholder();
        }
    });
    for (const type of [eventTypes.STREAM_TOKEN_RECEIVED, eventTypes.CHARACTER_MESSAGE_RENDERED, eventTypes.GENERATION_ENDED, eventTypes.GENERATION_STOPPED, eventTypes.CHAT_CHANGED]) {
        if (type) {
            onEvent(type, hideTyping);
        }
    }
    onEvent(eventTypes.CHARACTER_MESSAGE_RENDERED, (mesId) => {
        const message = SillyTavern.getContext().chat[Number(mesId)];
        const character = message?.original_avatar
            ?? SillyTavern.getContext().characters.find(x => x.name === message?.name)?.avatar;
        if (character) {
            touch(character);
        }
    });

    onDataChange(() => paintPresence());
    setInterval(gated(() => {
        paintPresence();
        options.changed();
    }), 60 * 1000);
}
