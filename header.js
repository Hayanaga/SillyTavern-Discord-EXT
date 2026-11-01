// The chat side: the header above the messages (@name or #channel and its tools), the profile
// panel or member list on the right, and the Friends page that stands in when no chat is open.

import { channelLabel, getCurrentPlace, getDirectMessages, getGroup, isPinned, onDataChange, openCharacter, togglePin } from './data.js';
import { formatListTime } from './messages.js';
import { isPlaceholder, monogramizeAll } from './monograms.js';
import { paintPresence, statusOf } from './presence.js';
import { initPins, togglePins } from './pins.js';
import { initSearch } from './search.js';
import { SHORTCUTS, showShortcuts, withShortcut } from './shortcuts.js';
import { openCharacterPanel, selectServer } from './sidebar.js';
import { clickOption, fullPictureUrl, getColorIndex, icon, iconButton, openDrawer, openMenu, shieldFromOutsideClose, t, toChannelName, toUsername } from './ui.js';
import { listen, onEvent } from './life.js';

const HEAD_ID = 'dsc-head';
const ASIDE_ID = 'dsc-aside';
const FRIENDS_ID = 'dsc-friends';
const TITLE_ID = 'dsc-titlebar';
/** Below this width the profile panel doesn't fit beside the chat (aside.css) */
const SHEET_QUERY = '(max-width: 1100px)';

/** A character whose profile shows in the panel in place of the chat's own (a member of a
    group, or anyone whose picture was clicked in the chat) */
let profileOverride = '';

let actions = {
    showAside: () => {},
    toggleAside: () => {},
    openSwitcher: (_text) => {},
    back: () => {},
};

/** Which Friends tab is showing: online (characters you talk to), all, add, or activity (the
    phone's Notifications tab: recent messages) */
let friendsTab = 'online';
let friendsFilter = '';

function currentCharacter() {
    const context = SillyTavern.getContext();
    return !context.groupId && context.characterId !== undefined ? context.characters[context.characterId] : null;
}

function currentGroup() {
    const context = SillyTavern.getContext();
    return context.groupId ? getGroup(context.groupId) : null;
}

/* ---------- header ---------- */

function headButton(className, label, iconName, run) {
    const button = iconButton(`dsc-head-tool ${className}`, label, iconName);
    button.dataset.dscTipSide = 'bottom';
    button.addEventListener('click', run);
    return button;
}

function createHeader() {
    const sheld = document.getElementById('sheld');
    if (!sheld || document.getElementById(HEAD_ID)) {
        return;
    }
    const head = document.createElement('section');
    head.id = HEAD_ID;

    const back = iconButton('dsc-head-back', t('Back'), 'burger');
    back.addEventListener('click', () => actions.back());

    const title = document.createElement('div');
    title.className = 'dsc-head-title';
    const glyph = document.createElement('span');
    glyph.className = 'dsc-head-glyph';
    const name = document.createElement('h1');
    name.className = 'dsc-head-name';
    const status = document.createElement('span');
    status.className = 'dsc-status dsc-head-status';
    const topic = document.createElement('span');
    topic.className = 'dsc-head-topic';
    title.append(glyph, name, status, topic);
    title.addEventListener('click', () => {
        if (document.body.classList.contains('dsc-friends-mode')) {
            return;
        }
        // phones and narrow windows have no room for the panel: the profile opens as a sheet
        const character = currentCharacter();
        if (window.matchMedia(SHEET_QUERY).matches && character) {
            showProfile(character.avatar);
            return;
        }
        actions.toggleAside();
    });

    // Friends page tabs
    const tabs = document.createElement('nav');
    tabs.className = 'dsc-head-tabs';
    // Discord's Pending and Blocked have no meaning for characters; Favorites does. Recent (no chat
    // open only) brings back SillyTavern's own home: recent chats, temporary chat, its links.
    for (const [key, label] of [['online', 'Online'], ['all', 'All'], ['favorites', 'Favorites'], ['recent', 'Recent'], ['add', 'Add Friend']]) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'dsc-head-tab';
        tab.dataset.tab = key;
        tab.textContent = t(label);
        tab.addEventListener('click', () => setFriendsTab(key));
        tabs.append(tab);
    }

    const tools = document.createElement('div');
    tools.className = 'dsc-head-tools';
    tools.append(
        headButton('dsc-for-dm dsc-tool-call', withShortcut(t('Start a New Chat'), SHORTCUTS.newChat), 'phone', () => clickOption('option_start_new_chat')),
        headButton('dsc-for-dm dsc-tool-video', t('Chat History'), 'video', () => clickOption('option_select_chat')),
        headButton('dsc-for-channel dsc-tool-threads', t('Chat History'), 'threads', () => clickOption('option_select_chat')),
        headButton('dsc-for-chat dsc-tool-pin', t('Pinned Messages'), 'pin', event => togglePins(/** @type {HTMLElement} */ (event?.currentTarget ?? document.querySelector('#dsc-head .dsc-tool-pin')))),
        headButton('dsc-for-dm dsc-convert dsc-tool-add', t('Convert to Group'), 'person-add', () => clickOption('option_convert_to_group')),
        headButton('dsc-for-dm dsc-aside-tool dsc-tool-profile', withShortcut(t('Show User Profile'), SHORTCUTS.members), 'profile', () => actions.toggleAside()),
        headButton('dsc-for-channel dsc-aside-tool dsc-tool-members', withShortcut(t('Show Member List'), SHORTCUTS.members), 'members', () => actions.toggleAside()),
    );
    const search = document.createElement('label');
    search.className = 'dsc-head-search';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = t('Search');
    input.setAttribute('aria-label', withShortcut(t('Search'), SHORTCUTS.search));
    initSearch(input);
    search.append(input, icon('search', 16));
    // phones: a magnifier that opens the search box across the header
    const phoneSearch = headButton('dsc-for-chat dsc-tool-search-phone', t('Search'), 'search', () => {
        document.body.classList.add('dsc-m-search');
        input.focus();
    });
    input.addEventListener('blur', () => {
        if (!input.value) {
            document.body.classList.remove('dsc-m-search');
        }
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            document.body.classList.remove('dsc-m-search');
        }
    });
    tools.append(search, phoneSearch);

    head.append(back, title, tabs, tools);
    sheld.prepend(head);
}

/** The title bar across the top: where you are in the middle, Inbox and Help on the right. */
function createTitlebar() {
    if (document.getElementById(TITLE_ID)) {
        return;
    }
    const bar = document.createElement('header');
    bar.id = TITLE_ID;
    const left = document.createElement('div');
    const middle = document.createElement('div');
    middle.className = 'dsc-tb-title';
    const glyph = document.createElement('span');
    glyph.className = 'dsc-tb-glyph';
    const name = document.createElement('span');
    name.className = 'dsc-tb-name';
    middle.append(glyph, name);
    const right = document.createElement('div');
    right.className = 'dsc-tb-tools';
    const tool = (className, label, iconName, run) => {
        const button = iconButton(`dsc-tb-tool ${className}`, label, iconName, 20);
        button.dataset.dscTipSide = 'bottom';
        button.addEventListener('click', run);
        return button;
    };
    right.append(
        tool('dsc-inbox', withShortcut(t('Inbox'), SHORTCUTS.inbox), 'inbox', (event) => openInbox(/** @type {HTMLElement} */ (event.currentTarget))),
        tool('dsc-help', withShortcut(t('Help'), SHORTCUTS.keybinds), 'help', () => showShortcuts()),
    );
    bar.append(left, middle, right);
    document.body.append(bar);
}

/** Inbox: the chat's own records, a menu like Discord's inbox tabs */
export function openInbox(anchor) {
    const target = anchor ?? document.querySelector(`#${TITLE_ID} .dsc-inbox`);
    if (!target) {
        return;
    }
    openMenu(/** @type {HTMLElement} */ (target), [
        { label: 'Chat History', icon: 'history', run: () => clickOption('option_select_chat') },
        { label: 'Start a New Chat', icon: 'phone', run: () => clickOption('option_start_new_chat') },
        { label: 'Close Chat', icon: 'close', run: () => clickOption('option_close_chat') },
    ], 'below-end');
}

export function togglePinCurrent() {
    const place = getCurrentPlace();
    if (place) {
        togglePin(place);
        refreshHeader();
    }
}

/** Fills the header for the open chat, a channel, or the Friends page. */
export function refreshHeader() {
    const head = document.getElementById(HEAD_ID);
    if (!head) {
        return;
    }
    const body = document.body.classList;
    const group = currentGroup();
    const character = currentCharacter();
    const hasChat = !!(group || character) && !!SillyTavern.getContext().getCurrentChatId();
    body.toggle('dsc-no-chat', !hasChat);
    body.toggle('dsc-channel', !!group);
    const friends = !body.contains('dsc-discover') && (body.contains('dsc-friends') || !hasChat);
    body.toggle('dsc-friends-mode', friends);
    if (hasChat && friendsTab === 'recent') {
        friendsTab = 'online';
    }
    body.toggle('dsc-home', friends && friendsTab === 'recent');

    const glyph = head.querySelector('.dsc-head-glyph');
    const name = head.querySelector('.dsc-head-name');
    const topic = head.querySelector('.dsc-head-topic');
    glyph.replaceChildren();
    topic.textContent = '';
    body.toggle('dsc-activity', friends && friendsTab === 'activity');
    if (body.contains('dsc-chars-open') || body.contains('dsc-discover')) {
        // the character panel or Discover stands in for the chat
        glyph.append(icon('compass'));
        name.textContent = t('Discover');
    } else if (friends && friendsTab === 'activity') {
        glyph.append(icon('bell'));
        name.textContent = t('Notifications');
    } else if (friends) {
        glyph.append(icon('friends'));
        name.textContent = t('Friends');
    } else if (group) {
        glyph.append(icon('hash'));
        const chatId = SillyTavern.getContext().getCurrentChatId() ?? '';
        name.textContent = toChannelName(channelLabel(group, chatId));
        topic.textContent = group.name;
    } else if (character) {
        glyph.append(icon('at'));
        name.textContent = character.name;
    }
    const headStatus = /** @type {HTMLElement} */ (head.querySelector('.dsc-head-status'));
    if (character && !group) {
        headStatus.dataset.dscPresence = character.avatar;
        paintPresence(head);
    } else {
        delete headStatus.dataset.dscPresence;
    }
    // the title bar names the place: the server for a channel, else the header's own title
    const titleGlyph = document.querySelector(`#${TITLE_ID} .dsc-tb-glyph`);
    const titleName = document.querySelector(`#${TITLE_ID} .dsc-tb-name`);
    if (titleGlyph && titleName) {
        titleGlyph.replaceChildren(group && !friends && !body.contains('dsc-chars-open') ? '' : glyph.firstElementChild?.cloneNode(true) ?? '');
        titleName.textContent = group && !friends && !body.contains('dsc-chars-open') ? group.name : name.textContent;
    }
    for (const tab of head.querySelectorAll('.dsc-head-tab')) {
        tab.classList.toggle('dsc-selected', tab.dataset.tab === friendsTab);
    }
    const pin = head.querySelector('.dsc-pin-tool');
    const pinned = !friends && isPinned(getCurrentPlace());
    pin?.classList.toggle('dsc-on', pinned);
    if (pin) {
        const label = withShortcut(t(pinned ? 'Unpin Chat' : 'Pin Chat'), SHORTCUTS.pin);
        pin.dataset.dscTip = label;
        pin.setAttribute('aria-label', label);
    }
    const asideOn = body.contains('dsc-aside-on');
    for (const tool of head.querySelectorAll('.dsc-aside-tool')) {
        tool.classList.toggle('dsc-on', asideOn);
        const base = tool.classList.contains('dsc-for-dm') ? (asideOn ? 'Hide User Profile' : 'Show User Profile') : (asideOn ? 'Hide Member List' : 'Show Member List');
        const label = withShortcut(t(base), SHORTCUTS.members);
        tool.dataset.dscTip = label;
        tool.setAttribute('aria-label', label);
    }
    refreshAside();
    if (friends) {
        renderFriends();
    }
}

/* ---------- profile panel and member list ---------- */

/** The average color of a picture, for the profile banner, as Discord picks one. */
const bannerColors = new Map();

async function bannerColor(src) {
    if (!bannerColors.has(src)) {
        bannerColors.set(src, (async () => {
            const img = new Image();
            img.src = src;
            await img.decode();
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(img, 0, 0, 1, 1);
            const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
            return `rgb(${r}, ${g}, ${b})`;
        })().catch(() => ''));
    }
    return bannerColors.get(src);
}

const DEFAULT_BANNERS = ['#5865f2', '#757e8a', '#3ba55c', '#faa61a', '#ed4245', '#eb459f'];

function createAside() {
    if (document.getElementById(ASIDE_ID)) {
        return;
    }
    const aside = document.createElement('aside');
    aside.id = ASIDE_ID;
    aside.addEventListener('click', (event) => {
        const row = /** @type {HTMLElement} */ (event.target).closest('.dsc-member');
        if (!row?.dataset.avatar) {
            return;
        }
        // Discord opens the member's profile card beside the list; phones show the sheet
        if (window.matchMedia(SHEET_QUERY).matches) {
            showProfile(row.dataset.avatar);
        } else {
            openPopout(row, { avatar: row.dataset.avatar }, 'left');
        }
    });
    aside.addEventListener('contextmenu', (event) => {
        const row = /** @type {HTMLElement} */ (event.target).closest('.dsc-member');
        if (!row?.dataset.avatar) {
            return;
        }
        event.preventDefault();
        openMenu(row, [
            { label: 'Message', icon: 'chat', run: () => openCharacter(row.dataset.avatar) },
            { label: 'Profile', icon: 'profile', run: () => viewProfile(row.dataset.avatar) },
        ], { x: event.clientX, y: event.clientY });
    });
    document.body.append(aside);
}

/** Opens a character's card in SillyTavern's character panel. */
async function viewProfile(avatar) {
    const current = currentCharacter();
    if (current?.avatar !== avatar) {
        await openCharacter(avatar);
    }
    openCharacterPanel('');
    document.getElementById('rm_button_selected_ch')?.click();
}

/** Plain text of a card field, with {{char}} and {{user}} filled in. */
function plain(text, max = 300) {
    const { substituteParams } = SillyTavern.getContext();
    const div = document.createElement('div');
    div.innerHTML = SillyTavern.libs.DOMPurify.sanitize(substituteParams(String(text ?? '')), { ALLOWED_TAGS: [] });
    const value = (div.textContent || '').replace(/\s+/g, ' ').trim();
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function memberRow(character, online) {
    const { getThumbnailUrl } = SillyTavern.getContext();
    const row = document.createElement('div');
    row.className = 'dsc-member';
    row.classList.toggle('dsc-offline', !online);
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.dataset.avatar = character.avatar;
    const avatar = document.createElement('span');
    avatar.className = 'dsc-avatar';
    avatar.dataset.name = character.name;
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.src = getThumbnailUrl('avatar', character.avatar);
    const status = document.createElement('span');
    status.className = 'dsc-status';
    status.dataset.dscPresence = character.avatar;
    avatar.append(img, status);
    const name = document.createElement('span');
    name.className = 'dsc-row-name';
    name.textContent = character.name;
    row.append(avatar, name);
    return row;
}

function renderMembers(aside, group) {
    const { characters } = SillyTavern.getContext();
    const disabled = new Set(group.disabled_members ?? []);
    const members = (group.members ?? []).map(avatar => characters.find(x => x.avatar === avatar)).filter(Boolean);
    // Discord lists members by role: here who's online, who's muted in this server (SillyTavern's
    // disabled members, who don't reply), and who's offline
    const muted = members.filter(x => disabled.has(x.avatar));
    const isOnline = x => !disabled.has(x.avatar) && statusOf(x.avatar) !== 'offline';
    const online = members.filter(isOnline);
    const offline = members.filter(x => !disabled.has(x.avatar) && !isOnline(x));
    const parts = [];
    const heading = (label, count) => {
        const h = document.createElement('h3');
        h.className = 'dsc-members-heading';
        h.textContent = `${t(label)} — ${count}`;
        return h;
    };
    if (online.length) {
        parts.push(heading('Online', online.length), ...online.map(x => memberRow(x, true)));
    }
    if (muted.length) {
        parts.push(heading('Muted', muted.length), ...muted.map((x) => {
            const row = memberRow(x, false);
            row.classList.add('dsc-member-muted');
            row.title = t('Muted in this server: doesn\'t reply');
            return row;
        }));
    }
    if (offline.length) {
        parts.push(heading('Offline', offline.length), ...offline.map(x => memberRow(x, false)));
    }
    aside.replaceChildren(...parts, memberDeck(members));
    paintPresence(aside);
    monogramizeAll(aside, '.dsc-avatar img', img => img.parentElement?.dataset.name ?? '');
}

/* ---------- character pictures: one card in a DM, a deck in a server ---------- */

/** The most cards a server's deck shows */
const DECK_MAX = 5;

/** A character's full picture as a rounded card; it goes if the character has no picture. */
function pictureCard(character, className, gone = () => {}) {
    const card = document.createElement('div');
    card.className = className;
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.src = fullPictureUrl('avatar', character.avatar);
    card.append(img);
    isPlaceholder(SillyTavern.getContext().getThumbnailUrl('avatar', character.avatar)).then((placeholder) => {
        if (placeholder) {
            card.remove();
            gone();
        }
    });
    return card;
}

/** Members in the order they last spoke in this chat, the latest first; the silent ones after. */
function bySpeaker(members) {
    const { chat } = SillyTavern.getContext();
    const order = [];
    for (let i = chat.length - 1; i >= 0 && order.length < members.length; i--) {
        const message = chat[i];
        if (message.is_user || message.is_system) {
            continue;
        }
        const member = members.find(x => x.avatar === message.original_avatar) ?? members.find(x => x.name === message.name);
        if (member && !order.includes(member)) {
            order.push(member);
        }
    }
    return [...order, ...members.filter(x => !order.includes(x))];
}

/** The server's members as a cascade of picture cards, whoever spoke last on top. */
function memberDeck(members) {
    const deck = document.createElement('div');
    deck.className = 'dsc-deck';
    for (const member of members) {
        const card = pictureCard(member, 'dsc-deck-card', () => stackDeck(deck, members));
        card.dataset.avatar = member.avatar;
        card.setAttribute('role', 'button');
        card.tabIndex = -1;
        card.title = member.name;
        const name = document.createElement('span');
        name.className = 'dsc-deck-name';
        name.textContent = member.name;
        card.append(name);
        card.addEventListener('click', () => showProfile(member.avatar));
        deck.append(card);
    }
    stackDeck(deck, members);
    return deck;
}

/** Puts the deck's cards in speaking order: --dsc-deck-i is a card's place, 0 on top. */
function stackDeck(deck, members) {
    const cards = [...deck.querySelectorAll('.dsc-deck-card')].map(card => /** @type {HTMLElement} */ (card).dataset.avatar);
    const order = bySpeaker(members).filter(x => cards.includes(x.avatar));
    const shown = Math.min(order.length, DECK_MAX);
    deck.style.setProperty('--dsc-deck-n', String(shown));
    for (const card of deck.querySelectorAll('.dsc-deck-card')) {
        const place = order.findIndex(x => x.avatar === /** @type {HTMLElement} */ (card).dataset.avatar);
        card.style.setProperty('--dsc-deck-i', String(place));
        card.classList.toggle('dsc-deck-top', place === 0);
        card.classList.toggle('dsc-deck-hidden', place >= DECK_MAX);
        card.tabIndex = place === 0 ? 0 : -1;
    }
}

/** A message came or went: the deck reorders (the list itself stays as it is). */
function restackDeck() {
    const deck = document.querySelector(`#${ASIDE_ID} .dsc-deck`);
    const group = currentGroup();
    if (!deck || !group) {
        return;
    }
    const { characters } = SillyTavern.getContext();
    const members = (group.members ?? []).map(avatar => characters.find(x => x.avatar === avatar)).filter(Boolean);
    stackDeck(/** @type {HTMLElement} */ (deck), members);
}

function renderProfile(aside, character) {
    const { getThumbnailUrl, groups, timestampToMoment } = SillyTavern.getContext();
    const src = getThumbnailUrl('avatar', character.avatar);
    const banner = document.createElement('div');
    banner.className = 'dsc-prof-banner';
    banner.style.background = DEFAULT_BANNERS[getColorIndex(character.name)];
    const avatar = document.createElement('span');
    avatar.className = 'dsc-avatar dsc-prof-avatar';
    avatar.dataset.name = character.name;
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.src = fullPictureUrl('avatar', character.avatar);
    const status = document.createElement('span');
    status.className = 'dsc-status';
    status.dataset.dscPresence = character.avatar;
    avatar.append(img, status);
    isPlaceholder(src).then((placeholder) => {
        if (!placeholder) {
            bannerColor(src).then((color) => {
                if (color) {
                    banner.style.background = color;
                }
            });
        }
    });

    const card = document.createElement('div');
    card.className = 'dsc-prof-card';
    const name = document.createElement('h2');
    name.className = 'dsc-prof-name';
    name.textContent = character.name;
    const user = document.createElement('div');
    user.className = 'dsc-prof-user';
    user.textContent = toUsername(character.name);
    card.append(name, user);

    const section = (label, content) => {
        const block = document.createElement('section');
        block.className = 'dsc-prof-section';
        const h = document.createElement('h3');
        h.textContent = t(label);
        block.append(h, content);
        return block;
    };
    const about = plain(character.creator_notes || character.data?.creator_notes || character.description);
    if (about) {
        const p = document.createElement('p');
        p.textContent = about;
        card.append(section('About Me', p));
    }
    const since = character.create_date ? timestampToMoment(character.create_date) : null;
    if (since?.isValid?.()) {
        const p = document.createElement('p');
        p.textContent = since.format('ll');
        card.append(section('Member Since', p));
    }

    const mutual = groups.filter(group => (group.members ?? []).includes(character.avatar));
    const extra = document.createElement('div');
    extra.className = 'dsc-prof-card dsc-prof-links';
    const mutualRow = document.createElement('button');
    mutualRow.type = 'button';
    mutualRow.className = 'dsc-prof-link';
    mutualRow.textContent = `${t('Mutual Servers')} — ${mutual.length}`;
    mutualRow.append(icon('chevron', 16));
    mutualRow.addEventListener('click', (event) => {
        if (!mutual.length) {
            return;
        }
        openMenu(/** @type {HTMLElement} */ (event.currentTarget), mutual.map(group => ({
            label: group.name, run: () => selectServer(String(group.id), true),
        })), 'below');
    });
    extra.append(mutualRow);

    const full = document.createElement('button');
    full.type = 'button';
    full.className = 'dsc-prof-full';
    full.textContent = t('View Full Profile');
    full.addEventListener('click', () => viewProfile(character.avatar));

    const close = iconButton('dsc-prof-close', t('Close'), 'close', 20);
    close.addEventListener('click', closeProfileSheet);
    aside.replaceChildren(close, banner, avatar, card, extra, pictureCard(character, 'dsc-prof-picture'), full);
    paintPresence(aside);
    monogramizeAll(aside, '.dsc-prof-avatar img', () => character.name);
}

function refreshAside() {
    const aside = document.getElementById(ASIDE_ID);
    if (!aside) {
        return;
    }
    const group = currentGroup();
    const character = currentCharacter();
    const override = profileOverride ? SillyTavern.getContext().characters.find(x => x.avatar === profileOverride) : null;
    aside.classList.toggle('dsc-members', !!group && !override);
    const key = override ? `o:${override.avatar}:${override.name}:${group ? 'g' : 'c'}`
        : group ? `g:${group.id}:${(group.members ?? []).join(',')}:${(group.disabled_members ?? []).join(',')}` : character ? `c:${character.avatar}:${character.name}` : '';
    if (aside.dataset.key === key) {
        return;
    }
    aside.dataset.key = key;
    if (override) {
        renderProfile(aside, override);
        // in a server, the way back to its member list
        if (group) {
            const back = document.createElement('button');
            back.type = 'button';
            back.className = 'dsc-prof-back';
            back.append(icon('back', 16), document.createTextNode(t('Members')));
            back.addEventListener('click', () => {
                profileOverride = '';
                refreshAside();
            });
            aside.prepend(back);
        }
    } else if (group) {
        renderMembers(aside, group);
    } else if (character) {
        renderProfile(aside, character);
    } else {
        aside.replaceChildren();
    }
}

/** Presence changed: regroup the member list and the Friends page. */
export function refreshPresenceViews() {
    const aside = document.getElementById(ASIDE_ID);
    if (aside?.classList.contains('dsc-members')) {
        aside.dataset.key = '';
        refreshAside();
    }
    if (document.body.classList.contains('dsc-friends-mode')) {
        renderFriends();
    }
}

/** Shows a character's profile in the right-hand panel (a sheet on phones), opening the panel
    if it's hidden, as Discord does when you click someone's name or picture. */
function showProfile(avatar) {
    const context = SillyTavern.getContext();
    const current = currentCharacter();
    profileOverride = current?.avatar === avatar ? '' : avatar;
    if (!context.characters.some(x => x.avatar === avatar)) {
        return;
    }
    actions.showAside();
    const aside = document.getElementById(ASIDE_ID);
    if (aside) {
        aside.dataset.key = '';
    }
    refreshAside();
    if (window.matchMedia(SHEET_QUERY).matches) {
        document.body.classList.add('dsc-profile-sheet');
    }
}

function closeProfileSheet() {
    document.body.classList.remove('dsc-profile-sheet');
}

/** The character behind a message: its own record for group messages, else by name. */
function characterOfMessage(mes) {
    const context = SillyTavern.getContext();
    const message = context.chat[Number(mes.getAttribute('mesid'))];
    if (!message || message.is_user || message.is_system) {
        return null;
    }
    if (message.original_avatar) {
        return context.characters.find(x => x.avatar === message.original_avatar) ?? null;
    }
    const current = currentCharacter();
    if (current && current.name === message.name) {
        return current;
    }
    return context.characters.find(x => x.name === message.name) ?? null;
}

/** A click on a character's picture or name in the chat opens their profile (caught on the
    way down, ahead of SillyTavern's own picture zoom, which listens on the chat itself). */
function initProfileClicks() {
    listen(document, 'click', (event) => {
        if (!document.body.classList.contains('discord-theme')) {
            return;
        }
        const target = /** @type {HTMLElement} */ (event.target);
        const hit = /** @type {HTMLElement} */ (target.closest?.('#chat .mes .avatar, #chat .mes .name_text'));
        const mes = hit?.closest('.mes');
        if (!mes) {
            return;
        }
        const sheet = window.matchMedia(SHEET_QUERY).matches;
        // your own messages: your profile card (on desktop)
        if (mes.getAttribute('is_user') === 'true') {
            if (!sheet) {
                event.preventDefault();
                event.stopPropagation();
                openPopout(hit, { persona: true, picture: mes.querySelector('.avatar img')?.getAttribute('src') ?? '' }, 'right');
            }
            return;
        }
        const character = characterOfMessage(mes);
        if (!character) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (sheet) {
            showProfile(character.avatar);
        } else {
            openPopout(hit, { avatar: character.avatar }, 'right');
        }
    }, true);
    const { eventTypes } = SillyTavern.getContext();
    for (const type of [eventTypes.CHARACTER_MESSAGE_RENDERED, eventTypes.MESSAGE_DELETED, eventTypes.MESSAGE_SWIPED]) {
        onEvent(type, restackDeck);
    }
    onEvent(SillyTavern.getContext().eventTypes.CHAT_CHANGED, () => {
        profileOverride = '';
        closeProfileSheet();
        closePopout();
    });
    listen(document, 'pointerdown', (event) => {
        const popout = document.getElementById(POPOUT_ID);
        const target = /** @type {HTMLElement} */ (event.target);
        if (popout && !popout.contains(target) && !document.getElementById('dsc-menu')?.contains(target)) {
            closePopout();
        }
    }, true);
    listen(document, 'keydown', (event) => {
        if (event.key === 'Escape' && document.getElementById(POPOUT_ID)) {
            event.preventDefault();
            event.stopPropagation();
            closePopout();
        }
    }, true);
    listen(window, 'resize', closePopout);
}

/* ---------- profile popout ---------- */

const POPOUT_ID = 'dsc-popout';

function closePopout() {
    document.getElementById(POPOUT_ID)?.remove();
}

/** Your own card: persona picture, name and description, with Edit Profile. */
function renderPersona(popout, picture = '') {
    const { name1, getThumbnailUrl, powerUserSettings } = SillyTavern.getContext();
    // the persona's file: from the clicked message's picture, else the one picked in Persona Management
    let avatarId = '';
    try {
        avatarId = picture ? new URL(picture, location.href).searchParams.get('file') ?? '' : '';
    } catch {
        avatarId = '';
    }
    avatarId ||= document.querySelector('#user_avatar_block .avatar-container.selected')?.getAttribute('data-avatar-id') ?? '';
    const src = picture || (avatarId ? getThumbnailUrl('persona', avatarId) : '');
    const banner = document.createElement('div');
    banner.className = 'dsc-prof-banner';
    banner.style.background = DEFAULT_BANNERS[getColorIndex(name1)];
    const avatar = document.createElement('span');
    avatar.className = 'dsc-avatar dsc-prof-avatar';
    avatar.dataset.name = name1;
    const img = document.createElement('img');
    img.alt = '';
    if (src) {
        img.decoding = 'async';
        img.src = avatarId ? fullPictureUrl('persona', avatarId) : src;
        isPlaceholder(src).then(placeholder => !placeholder && bannerColor(src).then(color => color && (banner.style.background = color)));
    }
    avatar.append(img);
    const card = document.createElement('div');
    card.className = 'dsc-prof-card';
    const name = document.createElement('h2');
    name.className = 'dsc-prof-name';
    name.textContent = name1;
    const user = document.createElement('div');
    user.className = 'dsc-prof-user';
    user.textContent = toUsername(name1);
    card.append(name, user);
    const about = plain(powerUserSettings?.persona_descriptions?.[avatarId]?.description ?? powerUserSettings?.persona_description);
    if (about) {
        const block = document.createElement('section');
        block.className = 'dsc-prof-section';
        const h = document.createElement('h3');
        h.textContent = t('About Me');
        const p = document.createElement('p');
        p.textContent = about;
        block.append(h, p);
        card.append(block);
    }
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'dsc-prof-full';
    edit.textContent = t('Edit Profile');
    edit.addEventListener('click', () => {
        closePopout();
        openDrawer('persona-management-button');
    });
    popout.replaceChildren(banner, avatar, card, edit);
    monogramizeAll(popout, '.dsc-prof-avatar img', () => name1);
}

/** The "Message @name" box at the bottom of a character's card: sends in their DM. */
function messageBox(character) {
    const box = document.createElement('input');
    box.type = 'text';
    box.className = 'dsc-popout-message';
    box.placeholder = `${t('Message')} @${toUsername(character.name)}`;
    box.setAttribute('aria-label', box.placeholder);
    box.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter' || event.isComposing || !box.value.trim()) {
            return;
        }
        event.preventDefault();
        const text = box.value;
        closePopout();
        if (currentCharacter()?.avatar !== character.avatar || currentGroup()) {
            await openCharacter(character.avatar);
        }
        const input = /** @type {HTMLTextAreaElement} */ (document.getElementById('send_textarea'));
        if (input) {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('send_but')?.click();
        }
    });
    return box;
}

/**
 * Discord's profile popout: a small card beside what was clicked.
 * @param {Element} anchor The picture, name or member row clicked
 * @param {{avatar?: string, persona?: boolean, picture?: string}} who A character (by avatar),
 *   or yourself (with your message's picture)
 * @param {'left'|'right'} side Which side of the anchor the card opens on
 */
function openPopout(anchor, who, side) {
    const already = document.getElementById(POPOUT_ID);
    if (already && already.dataset.who === (who.avatar ?? 'me')) {
        // a second click on the same person closes it, as in Discord
        closePopout();
        return;
    }
    closePopout();
    const popout = document.createElement('div');
    popout.id = POPOUT_ID;
    popout.setAttribute('role', 'dialog');
    popout.dataset.who = who.avatar ?? 'me';
    if (who.persona) {
        renderPersona(popout, who.picture);
        popout.setAttribute('aria-label', SillyTavern.getContext().name1);
    } else {
        const character = SillyTavern.getContext().characters.find(x => x.avatar === who.avatar);
        if (!character) {
            return;
        }
        renderProfile(popout, character);
        popout.querySelector('.dsc-prof-close')?.remove();
        popout.querySelector('.dsc-prof-full')?.addEventListener('click', closePopout);
        popout.append(messageBox(character));
        popout.setAttribute('aria-label', character.name);
    }
    shieldFromOutsideClose(popout);
    document.body.append(popout);
    const box = anchor.getBoundingClientRect();
    const own = popout.getBoundingClientRect();
    const gap = 8;
    let left = side === 'left' ? box.left - own.width - gap : box.right + gap;
    left = Math.max(gap, Math.min(left, window.innerWidth - own.width - gap));
    const top = Math.max(gap, Math.min(box.top, window.innerHeight - own.height - gap));
    popout.style.left = `${Math.round(left)}px`;
    popout.style.top = `${Math.round(top)}px`;
}

/* ---------- Friends page ---------- */

function createFriends() {
    const sheld = document.getElementById('sheld');
    if (!sheld || document.getElementById(FRIENDS_ID)) {
        return;
    }
    const page = document.createElement('div');
    page.id = FRIENDS_ID;

    const main = document.createElement('div');
    main.className = 'dsc-fr-main';
    const searchRow = document.createElement('label');
    searchRow.className = 'dsc-fr-search';
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = t('Search');
    search.addEventListener('input', () => {
        friendsFilter = search.value;
        renderFriends();
    });
    searchRow.append(search, icon('search', 18));
    const heading = document.createElement('h2');
    heading.className = 'dsc-fr-heading';
    const list = document.createElement('div');
    list.className = 'dsc-fr-list';
    list.addEventListener('click', (event) => {
        const target = /** @type {HTMLElement} */ (event.target);
        const row = /** @type {HTMLElement} */ (target.closest('.dsc-friend'));
        if (!row) {
            return;
        }
        if (target.closest('.dsc-fr-more')) {
            openMenu(/** @type {HTMLElement} */ (target.closest('.dsc-fr-more')), [
                { label: 'Message', icon: 'chat', run: () => openCharacter(row.dataset.avatar) },
                { label: 'Profile', icon: 'profile', run: () => viewProfile(row.dataset.avatar) },
            ], 'below-end');
            return;
        }
        openCharacter(row.dataset.avatar);
    });

    // Add Friend: Discord's form, which makes a new character here
    const add = document.createElement('form');
    add.className = 'dsc-fr-add';
    const addTitle = document.createElement('h2');
    addTitle.textContent = t('Add Friend');
    const addText = document.createElement('p');
    addText.textContent = t('You can add friends with their name.');
    const field = document.createElement('div');
    field.className = 'dsc-fr-add-field';
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = t('You can add friends with their name.');
    addInput.autocomplete = 'off';
    const addButton = document.createElement('button');
    addButton.type = 'submit';
    addButton.className = 'dsc-button';
    addButton.textContent = t('Send Friend Request');
    addButton.disabled = true;
    addInput.addEventListener('input', () => {
        addButton.disabled = !addInput.value.trim();
    });
    field.append(addInput, addButton);
    add.append(addTitle, addText, field);
    add.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = addInput.value.trim();
        openCharacterPanel('rm_button_create');
        const pole = /** @type {HTMLInputElement} */ (document.getElementById('character_name_pole'));
        if (pole && value) {
            pole.value = value;
            pole.dispatchEvent(new Event('input', { bubbles: true }));
        }
        addInput.value = '';
        addButton.disabled = true;
    });

    main.append(searchRow, heading, list, add);

    const active = document.createElement('aside');
    active.className = 'dsc-fr-active';
    const activeTitle = document.createElement('h2');
    activeTitle.textContent = t('Active Now');
    const activeCard = document.createElement('div');
    activeCard.className = 'dsc-fr-active-card';
    const quiet = document.createElement('h3');
    quiet.textContent = t('It\'s quiet for now...');
    const quietText = document.createElement('p');
    quietText.textContent = t('When a friend starts an activity—like playing a game or hanging out on voice—we\'ll show it here!');
    activeCard.append(quiet, quietText);
    active.append(activeTitle, activeCard);

    page.append(main, active);
    sheld.append(page);
}

export function setFriendsTab(tab) {
    friendsTab = tab;
    document.body.classList.add('dsc-friends');
    refreshHeader();
}

function friendRow(character) {
    const { getThumbnailUrl } = SillyTavern.getContext();
    const row = document.createElement('div');
    row.className = 'dsc-friend';
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.dataset.avatar = character.avatar;
    const avatar = document.createElement('span');
    avatar.className = 'dsc-avatar';
    avatar.dataset.name = character.name;
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = getThumbnailUrl('avatar', character.avatar);
    const status = document.createElement('span');
    status.className = 'dsc-status';
    status.dataset.dscPresence = character.avatar;
    avatar.append(img, status);
    const text = document.createElement('span');
    text.className = 'dsc-friend-text';
    const name = document.createElement('span');
    name.className = 'dsc-friend-name';
    name.textContent = character.name;
    const user = document.createElement('span');
    user.className = 'dsc-friend-user';
    user.textContent = toUsername(character.name);
    const sub = document.createElement('span');
    sub.className = 'dsc-friend-sub';
    sub.dataset.dscPresenceText = character.avatar;
    text.append(name, user, sub);
    const tools = document.createElement('span');
    tools.className = 'dsc-friend-tools';
    const message = iconButton('dsc-fr-tool dsc-fr-message', t('Message'), 'threads', 20);
    const more = iconButton('dsc-fr-tool dsc-fr-more', t('More'), 'more', 20);
    tools.append(message, more);
    row.append(avatar, text, tools);
    return row;
}

/** How many friend rows to draw at once; more follow as the list scrolls */
const FRIENDS_PAGE = 60;

function renderFriends() {
    const page = document.getElementById(FRIENDS_ID);
    if (!page) {
        return;
    }
    page.dataset.tab = friendsTab;
    const list = page.querySelector('.dsc-fr-list');
    const heading = page.querySelector('.dsc-fr-heading');
    if (friendsTab === 'add') {
        list.replaceChildren();
        return;
    }
    if (friendsTab === 'activity') {
        renderActivity(list, heading);
        paintPresence(list);
        return;
    }
    const { characters } = SillyTavern.getContext();
    const needle = friendsFilter.trim().toLowerCase();
    const byName = (a, b) => String(a.name).localeCompare(String(b.name));
    const isFav = x => x.fav === true || x.fav === 'true';
    let people = friendsTab === 'online' ? characters.filter(x => statusOf(x.avatar) !== 'offline').sort(byName)
        : friendsTab === 'favorites' ? characters.filter(isFav).sort(byName)
            : [...characters].sort(byName);
    if (needle) {
        people = people.filter(x => String(x.name).toLowerCase().includes(needle));
    }
    const headings = { online: 'Online', all: 'All Friends', favorites: 'Favorites' };
    heading.textContent = `${t(headings[friendsTab] ?? 'All Friends')} — ${people.length}`;
    const draw = (from) => {
        const rows = people.slice(from, from + FRIENDS_PAGE).map(friendRow);
        list.append(...rows);
        rows.forEach(row => paintPresence(row));
        monogramizeAll(list, '.dsc-friend:not([data-mono-done]) .dsc-avatar img', img => img.parentElement?.dataset.name ?? '');
        rows.forEach(row => row.setAttribute('data-mono-done', ''));
        if (from + FRIENDS_PAGE < people.length) {
            const more = document.createElement('div');
            more.className = 'dsc-fr-sentinel';
            list.append(more);
            const observer = new IntersectionObserver((entries) => {
                if (entries.some(entry => entry.isIntersecting)) {
                    observer.disconnect();
                    more.remove();
                    draw(from + FRIENDS_PAGE);
                }
            }, { root: list });
            observer.observe(more);
        }
    };
    list.replaceChildren();
    if (!people.length) {
        const empties = {
            online: 'No one\'s around right now. Say hi to someone and they\'ll come online.',
            favorites: 'No favorites yet. Star a character in their profile to keep them here.',
            all: needle ? 'No one by that name.' : 'No friends yet. Add one with Add Friend.',
        };
        const empty = document.createElement('div');
        empty.className = 'dsc-fr-empty';
        empty.textContent = t(needle ? 'No one by that name.' : empties[friendsTab] ?? empties.all);
        list.append(empty);
        // first run: no characters at all, so say where to start
        if (!needle && !SillyTavern.getContext().characters.length) {
            empty.textContent = t('Nobody here yet. Make your first character, or bring one in, and they\'ll show up as a friend you can message.');
            const start = document.createElement('div');
            start.className = 'dsc-fr-start';
            const button = (label, primary, run) => {
                const element = document.createElement('button');
                element.type = 'button';
                element.className = `menu_button${primary ? ' dsc-primary' : ''}`;
                element.textContent = t(label);
                element.addEventListener('click', run);
                return element;
            };
            start.append(
                button('Create a Character', true, () => {
                    openCharacterPanel('');
                    document.getElementById('rm_button_create')?.click();
                }),
                button('Import a Character', false, () => document.getElementById('character_import_button')?.click()),
            );
            list.append(start);
        }
        return;
    }
    draw(0);
}

/** Recent messages, newest first: who wrote, what, and when. */
function renderActivity(list, heading) {
    const dms = getDirectMessages().filter(dm => !dm.pinned || dm.preview).sort((a, b) => b.lastMes - a.lastMes);
    heading.textContent = t('Recent Activity');
    list.replaceChildren(...dms.map((dm) => {
        const row = friendRow(dm.character);
        row.classList.add('dsc-activity-row');
        const sub = /** @type {HTMLElement} */ (row.querySelector('.dsc-friend-sub'));
        delete sub.dataset.dscPresenceText;
        sub.textContent = dm.preview;
        const time = document.createElement('span');
        time.className = 'dsc-activity-time';
        time.textContent = formatListTime(dm.lastMes);
        row.querySelector('.dsc-friend-tools').replaceChildren(time);
        return row;
    }));
    monogramizeAll(list, '.dsc-avatar img', img => img.parentElement?.dataset.name ?? '');
}

/**
 * @param {object} options
 * @param {() => void} options.showAside
 * @param {() => void} options.toggleAside
 * @param {(text: string) => void} options.openSwitcher
 * @param {() => void} options.back
 */
export function initHeader(options) {
    actions = { ...actions, ...options };
    createTitlebar();
    createHeader();
    createAside();
    createFriends();
    initProfileClicks();
    initPins({ isChatPinned: () => isPinned(getCurrentPlace()), toggleChatPin: togglePinCurrent });
    refreshHeader();
    // the Friends page lists the people you talk to, which arrive with the conversation list
    onDataChange(() => {
        if (document.body.classList.contains('dsc-friends-mode')) {
            renderFriends();
        }
    });
}

