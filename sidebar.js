// The two columns on the left: the server rail (Direct Messages, one server per group, then
// Add a Server and Discover) and the list beside it (direct messages at home, a server's
// channels when one is picked), with your own panel at the bottom.

import { USER, nameFor } from './lib/chat-nicknames.js';
import { getChannels, getCurrentPlace, getDirectMessages, getGroup, getServers, isCurrent, isPinned, latestChannel, onDataChange, openPlace, togglePin } from './data.js';
import { isPlaceholder, monogramizeAll } from './monograms.js';
import { repaintUnread } from './notify.js';
import { paintPresence } from './presence.js';
import { clickOption, closeDrawers, getAcronym, getColorIndex, getInitials, icon, iconButton, isDrawerOpen, openDrawer, openMenu, serverPicture, t, toChannelName } from './ui.js';
import { formatKeys, SHORTCUTS } from './shortcuts.js';
import { isFolder, leaveFolder, locate, move, moveFolder, normalize, step, ungroup, updateFolder } from './lib/server-layout.js';
import { onEvent } from './life.js';

const RAIL_ID = 'dsc-guilds';
const SIDE_ID = 'dsc-side';
const HIDDEN_DMS_KEY = 'dsc-hidden-dms';
const COLLAPSED_KEY = 'dsc-collapsed-categories';

/** '' while home (direct messages) is picked, else the picked group's id */
let selectedServer = '';
let actions = {
    showFriends: (_on, _tab) => {},
    openSwitcher: (_text) => {},
    openSettings: (_drawerId) => {},
    showChat: () => {},
    showDiscover: () => {},
    /** the rail's order and folders (lib/server-layout.js), kept in the theme's settings */
    getLayout: () => /** @type {any[]} */ ([]),
    setLayout: (_layout) => {},
};

/* ---------- server rail ---------- */

function railItem(className, tip) {
    const item = document.createElement('div');
    item.className = `dsc-guild ${className}`.trim();
    const pill = document.createElement('span');
    pill.className = 'dsc-pill';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dsc-guild-icon';
    button.setAttribute('aria-label', tip);
    button.dataset.dscTip = tip;
    button.dataset.dscTipSide = 'right';
    item.append(pill, button);
    return item;
}

function buildServer(group) {
    if (!group) {
        return null;
    }
    const item = railItem('dsc-server', group.name);
    item.draggable = true;
    item.dataset.group = String(group.id);
    const button = item.querySelector('button');
    const picture = serverPicture(group);
    if (picture) {
        button.append(picture);
    } else {
        const acronym = document.createElement('span');
        acronym.className = 'dsc-acronym';
        const text = getAcronym(group.name);
        acronym.textContent = text;
        acronym.dataset.len = String(Math.min(4, [...text].length));
        button.append(acronym);
    }
    return item;
}

/** The rail's order and folders, with any new server added and any gone one dropped. */
function currentLayout() {
    return normalize(actions.getLayout(), getServers().map(group => String(group.id)));
}

function saveLayout(layout) {
    actions.setLayout(layout);
    renderRail();
}

const FOLDER_COLORS = [['', 'Default'], ['#5865f2', 'Blurple'], ['#57f287', 'Green'], ['#fee75c', 'Yellow'], ['#eb459e', 'Fuchsia'], ['#ed4245', 'Red'], ['#9b84ee', 'Purple'], ['#80848e', 'Gray']];

/** A folder: four small icons while closed; open, a folder icon with its servers under it. */
function buildFolder(folder, byId) {
    const wrap = document.createElement('div');
    wrap.className = 'dsc-folder';
    wrap.classList.toggle('dsc-folder-open', folder.open);
    wrap.dataset.folder = folder.folder;
    if (folder.color) {
        wrap.style.setProperty('--dsc-folder-color', folder.color);
    }
    const names = folder.ids.map(id => byId.get(id)?.name).filter(Boolean);
    const head = railItem('dsc-folder-head', folder.name || names.join(', '));
    head.dataset.folder = folder.folder;
    head.draggable = true;
    const button = head.querySelector('button');
    button.setAttribute('aria-expanded', String(folder.open));
    if (folder.open) {
        button.append(icon('folder', 24));
    } else {
        const grid = document.createElement('span');
        grid.className = 'dsc-folder-grid';
        for (const id of folder.ids.slice(0, 4)) {
            const mini = buildServer(byId.get(id))?.querySelector('.dsc-guild-icon > *');
            const cell = document.createElement('span');
            cell.className = 'dsc-folder-mini';
            if (mini) {
                cell.append(mini);
            }
            grid.append(cell);
        }
        button.append(grid);
    }
    wrap.append(head);
    if (folder.open) {
        const items = document.createElement('div');
        items.className = 'dsc-folder-items';
        items.append(...folder.ids.map(id => buildServer(byId.get(id))).filter(Boolean));
        wrap.append(items);
    }
    return wrap;
}

function openFolderMenu(anchor, folderId, at) {
    const folder = currentLayout().find(entry => isFolder(entry) && entry.folder === folderId);
    if (!folder) {
        return;
    }
    openMenu(anchor, [
        { label: folder.open ? 'Collapse Folder' : 'Expand Folder', icon: 'folder', run: () => saveLayout(updateFolder(currentLayout(), folderId, { open: !folder.open })) },
        { label: 'Rename Folder', icon: 'edit', run: () => renameFolder(folderId, folder.name) },
        { label: 'Ungroup Folder', icon: 'close', run: () => saveLayout(ungroup(currentLayout(), folderId)) },
        'separator',
        ...FOLDER_COLORS.map(([color, name]) => ({
            label: name,
            color: color || 'var(--dsc-blurple)',
            checked: folder.color === color,
            run: () => saveLayout(updateFolder(currentLayout(), folderId, { color })),
        })),
    ], at);
}

async function renameFolder(folderId, name) {
    const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();
    const value = await callGenericPopup(t('Folder Name'), POPUP_TYPE.INPUT, name ?? '', { okButton: t('Save') });
    if (typeof value === 'string') {
        saveLayout(updateFolder(currentLayout(), folderId, { name: value.trim().slice(0, 60) }));
    }
}

/** Dragging servers and folders in the rail, as in Discord: onto the upper or lower edge of an
    icon to put it before or after, onto the middle to make (or join) a folder. */
function initDragging(list) {
    let dragged = null;
    const clear = () => list.querySelectorAll('.dsc-drop-before, .dsc-drop-after, .dsc-drop-into').forEach(x => x.classList.remove('dsc-drop-before', 'dsc-drop-after', 'dsc-drop-into'));
    const targetOf = (event) => {
        const item = /** @type {HTMLElement} */ (event.target).closest?.('.dsc-server, .dsc-folder-head');
        if (!item || !dragged) {
            return null;
        }
        const id = item.classList.contains('dsc-folder-head') ? item.dataset.folder : item.dataset.group;
        if (id === dragged.id) {
            return null;
        }
        const box = item.getBoundingClientRect();
        const y = (event.clientY - box.top) / box.height;
        // a folder can only go before or after; a server can also go into another
        const position = dragged.folder ? (y < 0.5 ? 'before' : 'after') : (y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'into');
        return { item, id, position };
    };
    list.addEventListener('dragstart', (event) => {
        const item = /** @type {HTMLElement} */ (event.target).closest?.('.dsc-server, .dsc-folder-head');
        if (!item) {
            return;
        }
        dragged = item.classList.contains('dsc-folder-head') ? { id: item.dataset.folder, folder: true } : { id: item.dataset.group, folder: false };
        event.dataTransfer?.setData('text/plain', dragged.id);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
        item.classList.add('dsc-dragging');
    });
    list.addEventListener('dragover', (event) => {
        const target = targetOf(event);
        clear();
        if (!target) {
            return;
        }
        event.preventDefault();
        target.item.classList.add(`dsc-drop-${target.position}`);
    });
    list.addEventListener('dragleave', (event) => {
        if (!list.contains(/** @type {Node} */ (event.relatedTarget))) {
            clear();
        }
    });
    list.addEventListener('drop', (event) => {
        const target = targetOf(event);
        clear();
        if (!target || !dragged) {
            return;
        }
        event.preventDefault();
        const layout = currentLayout();
        saveLayout(dragged.folder ? moveFolder(layout, dragged.id, target.id, target.position) : move(layout, dragged.id, target.id, target.position));
    });
    list.addEventListener('dragend', () => {
        clear();
        list.querySelectorAll('.dsc-dragging').forEach(x => x.classList.remove('dsc-dragging'));
        dragged = null;
    });
}

function createRail() {
    if (document.getElementById(RAIL_ID)) {
        return;
    }
    const rail = document.createElement('nav');
    rail.id = RAIL_ID;
    rail.setAttribute('aria-label', t('Servers sidebar'));

    const home = railItem('dsc-home', t('Direct Messages'));
    home.querySelector('button').append(icon('clyde', 30));
    const sep = document.createElement('div');
    sep.className = 'dsc-guild-sep';
    const list = document.createElement('div');
    list.className = 'dsc-guild-list';
    const add = railItem('dsc-guild-action dsc-add', t('Add a Server'));
    add.querySelector('button').append(icon('plus'));
    const discover = railItem('dsc-guild-action dsc-discover', t('Discover'));
    discover.querySelector('button').append(icon('compass'));

    home.querySelector('button').addEventListener('click', goHome);
    add.querySelector('button').addEventListener('click', () => openCharacterPanel('rm_button_group_chats'));
    discover.querySelector('button').addEventListener('click', () => actions.showDiscover());

    list.addEventListener('click', (event) => {
        const head = /** @type {HTMLElement} */ (event.target).closest('.dsc-folder-head');
        if (head) {
            const folder = currentLayout().find(entry => isFolder(entry) && entry.folder === head.dataset.folder);
            if (folder) {
                saveLayout(updateFolder(currentLayout(), folder.folder, { open: !folder.open }));
            }
            return;
        }
        const item = /** @type {HTMLElement} */ (event.target).closest('.dsc-server');
        if (item) {
            selectServer(item.dataset.group, true);
        }
    });
    list.addEventListener('contextmenu', (event) => {
        const head = /** @type {HTMLElement} */ (event.target).closest('.dsc-folder-head');
        if (head) {
            event.preventDefault();
            openFolderMenu(head.querySelector('button'), head.dataset.folder, { x: event.clientX, y: event.clientY });
            return;
        }
        const item = /** @type {HTMLElement} */ (event.target).closest('.dsc-server');
        if (!item) {
            return;
        }
        event.preventDefault();
        openServerMenu(item.querySelector('button'), item.dataset.group, { x: event.clientX, y: event.clientY });
    });
    initDragging(list);

    rail.append(home, sep, list, add, discover);
    document.body.append(rail);
}

function renderRail() {
    const rail = document.getElementById(RAIL_ID);
    if (!rail) {
        return;
    }
    const list = rail.querySelector('.dsc-guild-list');
    const servers = getServers();
    const current = getCurrentPlace();
    const layout = currentLayout();
    // rebuild only when the servers, their names or the order and folders changed
    const signature = `${servers.map(group => `${group.id}:${group.name}:${group.avatar_url ?? ''}:${(group.members ?? []).slice(0, 4).join(',')}`).join('|')}#${JSON.stringify(layout)}`;
    if (list.dataset.signature !== signature) {
        list.dataset.signature = signature;
        const byId = new Map(servers.map(group => [String(group.id), group]));
        list.replaceChildren(...layout.map(entry => (isFolder(entry) ? buildFolder(entry, byId) : buildServer(byId.get(entry)))).filter(Boolean));
    }
    const discovering = document.body.classList.contains('dsc-discover');
    rail.querySelector('.dsc-home').classList.toggle('dsc-selected', !selectedServer && !discovering);
    rail.querySelector('.dsc-discover').classList.toggle('dsc-selected', discovering);
    for (const item of list.querySelectorAll('.dsc-server')) {
        item.classList.toggle('dsc-selected', item.dataset.group === selectedServer && !discovering);
        // a server with the open chat in it keeps a small pill, as one with unread messages does
        item.classList.toggle('dsc-unread', !!current?.group && item.dataset.group === String(current.group) && item.dataset.group !== selectedServer);
    }
}

function openServerMenu(anchor, groupId, at) {
    const group = getGroup(groupId);
    if (!group) {
        return;
    }
    const where = locate(currentLayout(), String(groupId));
    openMenu(anchor, [
        { label: 'Open', icon: 'chat', run: () => selectServer(groupId, true) },
        { label: 'Create Channel', icon: 'plus', run: () => createChannel(groupId) },
        'separator',
        // the rail's order without dragging (keyboard and screen readers too)
        { label: 'Move Up', icon: 'chevron', run: () => saveLayout(step(currentLayout(), String(groupId), -1)) },
        { label: 'Move Down', icon: 'chevron', run: () => saveLayout(step(currentLayout(), String(groupId), 1)) },
        where?.folder
            ? { label: 'Remove from Folder', icon: 'folder', run: () => saveLayout(leaveFolder(currentLayout(), String(groupId))) }
            : { label: 'Add to Folder with Next Server', icon: 'folder', run: () => folderWithNext(String(groupId)) },
        'separator',
        { label: 'Server Settings', icon: 'gear', run: () => editServer(groupId) },
    ], at);
}

/** Makes a folder of a server and the next one in the rail (the menu's way to make a folder). */
function folderWithNext(groupId) {
    const layout = currentLayout();
    const where = locate(layout, groupId);
    const next = where && layout[where.index + 1];
    if (!next) {
        toastr.info(t('Drag a server onto another to make a folder.'));
        return;
    }
    saveLayout(isFolder(next) ? move(layout, groupId, next.folder, 'into') : move(layout, groupId, next, 'into'));
}

/** Shows the group editor in SillyTavern's character panel. */
async function editServer(groupId) {
    await openPlace(latestChannel(getGroup(groupId)) ?? { group: groupId, avatar: '', fileId: '', fileName: '' });
    openDrawer('rightNavHolder');
    document.getElementById('rm_button_selected_ch')?.click();
}

/** A new channel is a new chat in that group. */
async function createChannel(groupId) {
    const group = getGroup(groupId);
    if (!group) {
        return;
    }
    await openPlace(latestChannel(group) ?? { group: groupId, avatar: '', fileId: '', fileName: '' });
    clickOption('option_start_new_chat');
}

function goHome() {
    closeDrawers();
    selectedServer = '';
    renderAll();
    const current = getCurrentPlace();
    // home shows your conversations; a group chat isn't one, so Friends takes its place
    actions.showFriends(!current || !!current.group, 'online');
}

/** Picks a server; with open=true it also opens its newest channel, as Discord returns you there. */
export async function selectServer(groupId, open = false) {
    closeDrawers();
    selectedServer = String(groupId);
    actions.showFriends(false);
    renderAll();
    if (open) {
        const current = getCurrentPlace();
        if (current?.group && String(current.group) === selectedServer) {
            actions.showChat();
            return;
        }
        const channel = latestChannel(getGroup(groupId));
        if (channel) {
            await openPlace(channel);
        }
    }
}

/** Opens SillyTavern's character panel on one of its tabs (characters, group chats, create). */
export function openCharacterPanel(buttonId) {
    openDrawer('rightNavHolder');
    if (buttonId) {
        document.getElementById(buttonId)?.click();
    }
}

/* ---------- the list column ---------- */

function getHiddenDms() {
    try {
        return JSON.parse(localStorage.getItem(HIDDEN_DMS_KEY) || '{}') || {};
    } catch {
        return {};
    }
}

/** Closing a DM hides it until there's something newer in it, as Discord does. */
function hideDm(avatar, lastMes) {
    const hidden = getHiddenDms();
    hidden[avatar] = lastMes;
    try {
        localStorage.setItem(HIDDEN_DMS_KEY, JSON.stringify(hidden));
    } catch {
        // storage can be refused in private windows
    }
    renderSide();
}

function getCollapsed() {
    try {
        return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]'));
    } catch {
        return new Set();
    }
}

function setCollapsed(set) {
    try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set]));
    } catch {
        // as above
    }
}

function createSide() {
    if (document.getElementById(SIDE_ID)) {
        return;
    }
    const side = document.createElement('aside');
    side.id = SIDE_ID;

    // home: the search button; a server: its name with a menu
    const head = document.createElement('div');
    head.className = 'dsc-side-head';
    const find = document.createElement('button');
    find.type = 'button';
    find.className = 'dsc-find';
    find.textContent = t('Find or start a conversation');
    find.addEventListener('click', () => actions.openSwitcher(''));
    const serverHead = document.createElement('button');
    serverHead.type = 'button';
    serverHead.className = 'dsc-server-head';
    const serverName = document.createElement('span');
    serverName.className = 'dsc-server-name';
    serverHead.append(serverName, icon('chevron', 18));
    serverHead.addEventListener('click', () => openServerMenu(serverHead, selectedServer, 'below'));
    head.append(find, serverHead);

    const scroll = document.createElement('div');
    scroll.className = 'dsc-side-scroll';
    scroll.addEventListener('click', onListClick);
    scroll.addEventListener('contextmenu', onListContextMenu);
    scroll.addEventListener('keydown', (event) => {
        const row = /** @type {HTMLElement} */ (event.target).closest?.('[role="button"]');
        if (row && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            row.click();
        }
    });

    side.append(head, scroll, createUserPanel());
    document.body.append(side);
}

function navRow(key, label, iconName, tip) {
    const row = document.createElement('div');
    row.className = 'dsc-nav-row';
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.dataset.nav = key;
    if (tip) {
        row.title = tip;
    }
    const text = document.createElement('span');
    text.className = 'dsc-row-name';
    text.textContent = t(label);
    row.append(icon(iconName), text);
    return row;
}

/** A round picture with a status dot; presence names the character whose status it shows. */
function avatarFor(src, name, presence = '') {
    const avatar = document.createElement('span');
    avatar.className = 'dsc-avatar';
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = src;
    avatar.append(img);
    const status = document.createElement('span');
    status.className = 'dsc-status';
    if (presence) {
        status.dataset.dscPresence = presence;
    }
    avatar.append(status);
    avatar.dataset.name = name;
    return avatar;
}

function buildDm(dm) {
    const { getThumbnailUrl } = SillyTavern.getContext();
    const row = document.createElement('div');
    row.className = 'dsc-dm';
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.dataset.avatar = dm.avatar;
    row.dataset.file = dm.fileId;
    row.dataset.last = String(dm.lastMes);
    const text = document.createElement('span');
    text.className = 'dsc-dm-text';
    const name = document.createElement('span');
    name.className = 'dsc-row-name';
    name.textContent = nameFor(dm.avatar ?? dm.character.avatar, dm.character.name, dm.fileId);
    const preview = document.createElement('span');
    preview.className = 'dsc-dm-preview';
    preview.textContent = document.body.classList.contains('dsc-chat-names') ? dm.fileId : dm.preview;
    text.append(name, preview);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dsc-dm-close';
    close.setAttribute('aria-label', t('Close DM'));
    close.append(icon('close', 16));
    row.append(avatarFor(getThumbnailUrl('avatar', dm.character.avatar), dm.character.name, dm.character.avatar), text, close);
    if (dm.pinned) {
        row.classList.add('dsc-pinned');
    }
    return row;
}

function renderHome(scroll) {
    const rows = [
        navRow('friends', 'Friends', 'friends', t('Characters')),
        navRow('nitro', 'Nitro', 'nitro', t('Extensions')),
        navRow('shop', 'Shop', 'shop', t('Backgrounds')),
    ];
    const head = document.createElement('h2');
    head.className = 'dsc-side-heading';
    const label = document.createElement('span');
    label.textContent = t('Direct Messages');
    const add = iconButton('dsc-heading-add', t('Create DM'), 'plus', 16);
    add.addEventListener('click', (event) => {
        event.stopPropagation();
        actions.openSwitcher('@');
    });
    head.append(label, add);

    const hidden = getHiddenDms();
    const current = getCurrentPlace();
    const dms = getDirectMessages().filter(dm => !(dm.avatar in hidden) || dm.lastMes > hidden[dm.avatar] || dm.avatar === current?.avatar);
    const list = document.createElement('div');
    list.className = 'dsc-dm-list';
    list.append(...dms.map(buildDm));
    if (!dms.length) {
        const empty = document.createElement('div');
        empty.className = 'dsc-dm-empty';
        for (let i = 0; i < 5; i++) {
            const ghost = document.createElement('div');
            ghost.className = 'dsc-dm-ghost';
            ghost.style.opacity = String(1 - i * 0.18);
            empty.append(ghost);
        }
        list.append(empty);
    }
    scroll.replaceChildren(...rows, head, list);
    paintPresence(list);
    repaintUnread();
    monogramizeAll(list, '.dsc-avatar img', img => img.parentElement?.dataset.name ?? '');
}

function renderServer(scroll, group) {
    const collapsed = getCollapsed();
    const key = `${group.id}:text`;
    const category = document.createElement('div');
    category.className = 'dsc-category';
    category.setAttribute('role', 'button');
    category.tabIndex = 0;
    category.dataset.key = key;
    category.classList.toggle('dsc-collapsed', collapsed.has(key));
    const label = document.createElement('span');
    label.textContent = t('Text Channels');
    const add = iconButton('dsc-heading-add', t('Create Channel'), 'plus', 16);
    add.addEventListener('click', (event) => {
        event.stopPropagation();
        createChannel(String(group.id));
    });
    category.append(icon('chevron', 12), label, add);

    const list = document.createElement('div');
    list.className = 'dsc-channel-list';
    for (const channel of getChannels(group)) {
        const row = document.createElement('div');
        row.className = 'dsc-channel';
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        row.dataset.group = channel.group;
        row.dataset.file = channel.fileId;
        row.title = channel.fileId;
        const name = document.createElement('span');
        name.className = 'dsc-row-name';
        name.textContent = toChannelName(channel.name);
        row.append(icon('hash', 20), name);
        if (isPinned(channel)) {
            row.classList.add('dsc-pinned');
        }
        list.append(row);
    }
    scroll.replaceChildren(category, list);
}

function renderSide() {
    const side = document.getElementById(SIDE_ID);
    if (!side) {
        return;
    }
    const scroll = side.querySelector('.dsc-side-scroll');
    const group = selectedServer ? getGroup(selectedServer) : null;
    if (selectedServer && !group) {
        selectedServer = '';
    }
    side.classList.toggle('dsc-side-server', !!group);
    if (group) {
        side.querySelector('.dsc-server-name').textContent = group.name;
        renderServer(scroll, group);
    } else {
        renderHome(scroll);
    }
    markCurrent();
}

/** Highlights the open chat and the page shown (Friends, Nitro, Shop). */
export function markCurrent() {
    renderRail();
    const side = document.getElementById(SIDE_ID);
    if (!side) {
        return;
    }
    const body = document.body.classList;
    let page = '';
    if (body.contains('dsc-discover')) {
        page = 'discover';
    } else if (body.contains('dsc-chars-open')) {
        page = 'friends';
    } else if (isDrawerOpen('extensions-settings-button')) {
        page = 'nitro';
    } else if (isDrawerOpen('backgrounds-button')) {
        page = 'shop';
    } else if (body.contains('dsc-friends') || body.contains('dsc-no-chat')) {
        page = 'friends';
    }
    for (const row of side.querySelectorAll('.dsc-nav-row')) {
        row.classList.toggle('dsc-selected', row.dataset.nav === page);
    }
    const showingChat = !page;
    for (const row of side.querySelectorAll('.dsc-dm')) {
        const on = showingChat && isCurrent({ group: '', avatar: row.dataset.avatar, fileId: row.dataset.file });
        row.classList.toggle('dsc-selected', on);
        row.toggleAttribute('aria-current', on);
    }
    for (const row of side.querySelectorAll('.dsc-channel')) {
        const on = !body.contains('dsc-chars-open') && isCurrent({ group: row.dataset.group, avatar: '', fileId: row.dataset.file });
        row.classList.toggle('dsc-selected', on);
        row.toggleAttribute('aria-current', on);
    }
}

function placeOfRow(row) {
    if (row.classList.contains('dsc-channel')) {
        return { group: row.dataset.group, avatar: '', fileId: row.dataset.file, fileName: `${row.dataset.file}.jsonl` };
    }
    return { group: '', avatar: row.dataset.avatar, fileId: row.dataset.file, fileName: `${row.dataset.file}.jsonl` };
}

function onListClick(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    const close = target.closest('.dsc-dm-close');
    if (close) {
        const row = /** @type {HTMLElement} */ (close.closest('.dsc-dm'));
        hideDm(row.dataset.avatar, Number(row.dataset.last) || Date.now());
        return;
    }
    const nav = /** @type {HTMLElement} */ (target.closest('.dsc-nav-row'));
    if (nav) {
        if (nav.dataset.nav === 'friends') {
            closeDrawers();
            actions.showFriends(true, 'online');
        } else {
            actions.openSettings(nav.dataset.nav === 'nitro' ? 'extensions-settings-button' : 'backgrounds-button');
        }
        return;
    }
    const category = /** @type {HTMLElement} */ (target.closest('.dsc-category'));
    if (category) {
        const set = getCollapsed();
        const on = category.classList.toggle('dsc-collapsed');
        on ? set.add(category.dataset.key) : set.delete(category.dataset.key);
        setCollapsed(set);
        return;
    }
    const row = /** @type {HTMLElement} */ (target.closest('.dsc-dm, .dsc-channel'));
    if (row) {
        closeDrawers();
        actions.showFriends(false);
        openPlace(placeOfRow(row));
    }
}

function onListContextMenu(event) {
    const row = /** @type {HTMLElement} */ (event.target).closest?.('.dsc-dm, .dsc-channel');
    if (!row) {
        return;
    }
    event.preventDefault();
    const place = placeOfRow(row);
    const pinned = isPinned(place);
    const items = [
        { label: row.classList.contains('dsc-dm') ? 'Message' : 'Open Channel', icon: 'chat', run: () => openPlace(place) },
        { label: pinned ? 'Unpin' : 'Pin', icon: 'pin', run: () => togglePin(place) },
    ];
    if (row.classList.contains('dsc-dm')) {
        items.push('separator', { label: 'Close DM', danger: true, run: () => hideDm(row.dataset.avatar, Number(row.dataset.last) || Date.now()) });
    }
    openMenu(row, items, { x: event.clientX, y: event.clientY });
}

/* ---------- your panel at the bottom ---------- */

function createUserPanel() {
    const panel = document.createElement('section');
    panel.id = 'dsc-user';
    const me = document.createElement('button');
    me.type = 'button';
    me.className = 'dsc-user-me';
    me.dataset.dscTip = t('My Account');
    const avatar = document.createElement('span');
    avatar.className = 'dsc-avatar';
    const img = document.createElement('img');
    img.alt = '';
    const mono = document.createElement('span');
    mono.className = 'dsc-monogram dsc-me-mono';
    mono.setAttribute('aria-hidden', 'true');
    const status = document.createElement('span');
    status.className = 'dsc-status dsc-status-on dsc-my-status';
    avatar.append(img, mono, status);
    const names = document.createElement('span');
    names.className = 'dsc-user-names';
    const name = document.createElement('span');
    name.className = 'dsc-user-name';
    const sub = document.createElement('span');
    sub.className = 'dsc-user-sub';
    sub.textContent = t('Online');
    names.append(name, sub);
    me.append(avatar, names);

    const tools = document.createElement('div');
    tools.className = 'dsc-user-tools';
    const mute = iconButton('dsc-user-tool dsc-mute', t('Mute'), 'mic', 20);
    const deafen = iconButton('dsc-user-tool dsc-deafen', t('Deafen'), 'headset', 20);
    const gear = iconButton('dsc-user-tool', `${t('User Settings')} (${formatKeys(SHORTCUTS.settings)})`, 'gear', 20);
    // mute and deafen only change how they look, as nothing here has sound
    mute.addEventListener('click', () => {
        const on = mute.classList.toggle('dsc-off');
        const label = t(on ? 'Unmute' : 'Mute');
        mute.dataset.dscTip = label;
        mute.setAttribute('aria-label', label);
    });
    deafen.addEventListener('click', () => {
        const on = deafen.classList.toggle('dsc-off');
        const label = t(on ? 'Undeafen' : 'Deafen');
        deafen.dataset.dscTip = label;
        deafen.setAttribute('aria-label', label);
        mute.classList.toggle('dsc-off', on);
    });
    gear.addEventListener('click', () => actions.openSettings(''));
    tools.append(mute, deafen, gear);
    panel.append(me, tools);
    return panel;
}

/** Your persona's name and picture in the panel (a default avatar when it has no picture). */
export function refreshPersona(avatarId) {
    const panel = document.getElementById('dsc-user');
    if (!panel) {
        return;
    }
    const { name1, getThumbnailUrl } = SillyTavern.getContext();
    panel.querySelector('.dsc-user-name').textContent = nameFor(USER, name1) || t('You');
    const mono = /** @type {HTMLElement} */ (panel.querySelector('.dsc-me-mono'));
    mono.textContent = getInitials(name1);
    mono.dataset.dscColor = String(getColorIndex(name1));
    const img = /** @type {HTMLImageElement} */ (panel.querySelector('.dsc-avatar img'));
    let src = '';
    if (typeof avatarId === 'string' && avatarId) {
        src = getThumbnailUrl('persona', avatarId);
    } else {
        const selected = document.querySelector('#user_avatar_block .avatar-container.selected');
        const id = selected?.getAttribute('data-avatar-id') || selected?.getAttribute('imgfile');
        src = id ? getThumbnailUrl('persona', id) : (selected?.querySelector('img')?.getAttribute('src') ?? '');
    }
    if (src) {
        img.src = src;
    }
    isPlaceholder(img.getAttribute('src') ?? '').then((placeholder) => {
        panel.classList.toggle('dsc-me-placeholder', placeholder);
    });
}

/* ---------- moving with the keyboard ---------- */

/** Alt+↑/↓: the previous or next conversation in the list. */
export function stepConversation(step) {
    const rows = [...document.querySelectorAll(`#${SIDE_ID} .dsc-dm, #${SIDE_ID} .dsc-channel`)];
    if (!rows.length) {
        return;
    }
    const index = rows.findIndex(row => row.classList.contains('dsc-selected'));
    const next = rows[(index + step + rows.length) % rows.length];
    /** @type {HTMLElement} */ (next)?.click();
}

/** Ctrl/⌘+Alt+↑/↓: the previous or next server, home included. */
export function stepServer(step) {
    const ids = ['', ...getServers().map(group => String(group.id))];
    const index = Math.max(0, ids.indexOf(selectedServer));
    const next = ids[(index + step + ids.length) % ids.length];
    if (next) {
        selectServer(next, true);
    } else {
        goHome();
    }
}

/* ---------- wiring ---------- */

function renderAll() {
    renderRail();
    renderSide();
}

/** Follows the open chat: a group chat picks its server, a character's chat picks home. */
function followChat() {
    const current = getCurrentPlace();
    if (current?.group) {
        selectedServer = String(current.group);
    } else if (current) {
        selectedServer = '';
    }
    renderAll();
}

/**
 * @param {object} options
 * @param {(on: boolean, tab?: string) => void} options.showFriends
 * @param {(text: string) => void} options.openSwitcher
 * @param {(drawerId: string) => void} options.openSettings
 * @param {() => void} options.showChat
 * @param {() => void} options.showDiscover
 */
export function initSidebar(options) {
    actions = { ...actions, ...options };
    createRail();
    createSide();
    onDataChange(renderAll);
    const { eventTypes } = SillyTavern.getContext();
    onEvent(eventTypes.CHAT_CHANGED, followChat);
    onEvent(eventTypes.GROUP_UPDATED, renderAll);
    followChat();
    refreshPersona();
}

