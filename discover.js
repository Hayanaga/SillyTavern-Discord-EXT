// Discover: Discord's discovery page for your characters and groups. A banner with a search
// box, quick actions (new character, import, new server), then cards: the picture as the
// banner, the icon over its edge, the name, a short description and who's online. A card
// opens the conversation; its ⋯ opens the profile or server settings.

import { getDirectMessages, getServers, latestChannel, openCharacter, openPlace } from './data.js';
import { isPlaceholder, monogramizeAll } from './monograms.js';
import { paintPresence } from './presence.js';
import { openCharacterPanel, selectServer } from './sidebar.js';
import { fullPictureUrl, getAcronym, getColorIndex, icon, iconButton, openMenu, serverPicture, t } from './ui.js';
import { onEvent } from './life.js';

const ID = 'dsc-discover';
const PAGE = 48;
/** Discord's default avatar colors, for banners of characters without a picture */
const BANNERS = ['#5865f2', '#757e8a', '#3ba55c', '#faa61a', '#ed4245', '#eb459f'];

let filter = '';
let category = 'all';
let onShow = () => {};

/** Plain text of a card field, short, with {{char}} and {{user}} filled in. */
function plain(text, max = 140) {
    const { substituteParams } = SillyTavern.getContext();
    const div = document.createElement('div');
    div.innerHTML = SillyTavern.libs.DOMPurify.sanitize(substituteParams(String(text ?? '')), { ALLOWED_TAGS: [] });
    const value = (div.textContent || '').replace(/\s+/g, ' ').trim();
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function items() {
    const { characters, getThumbnailUrl } = SillyTavern.getContext();
    const talked = new Set(getDirectMessages().map(dm => dm.avatar));
    const people = characters.map(character => ({
        kind: 'character',
        key: character.avatar,
        name: character.name,
        about: plain(character.creator_notes || character.data?.creator_notes || character.description),
        thumb: getThumbnailUrl('avatar', character.avatar),
        picture: fullPictureUrl('avatar', character.avatar),
        fav: character.fav === true || character.fav === 'true',
        recent: talked.has(character.avatar),
    }));
    const servers = getServers().map(group => ({
        kind: 'group',
        key: String(group.id),
        name: group.name,
        about: plain(group.description || ''),
        members: (group.members ?? []).length,
        group,
        fav: !!group.fav,
        recent: false,
    }));
    return [...servers, ...people];
}

function card(item) {
    const element = document.createElement('div');
    element.className = 'dsc-dv-card';
    element.setAttribute('role', 'button');
    element.tabIndex = 0;
    element.dataset.kind = item.kind;
    element.dataset.key = item.key;

    const banner = document.createElement('div');
    banner.className = 'dsc-dv-banner';
    const iconBox = document.createElement('div');
    iconBox.className = 'dsc-dv-icon';
    if (item.kind === 'character') {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = item.thumb;
        const bannerImg = /** @type {HTMLImageElement} */ (img.cloneNode());
        bannerImg.src = item.picture;
        banner.append(bannerImg);
        isPlaceholder(item.thumb).then((placeholder) => {
            if (placeholder) {
                banner.classList.add('dsc-dv-plain');
                banner.style.background = BANNERS[getColorIndex(item.name)];
            }
        });
        const holder = document.createElement('span');
        holder.className = 'dsc-avatar';
        holder.dataset.name = item.name;
        holder.append(img);
        iconBox.append(holder);
    } else {
        banner.classList.add('dsc-dv-banner-server');
        const picture = serverPicture(item.group);
        if (picture) {
            iconBox.append(picture);
        } else {
            const acronym = document.createElement('span');
            acronym.className = 'dsc-dv-acronym';
            acronym.textContent = getAcronym(item.name);
            iconBox.append(acronym);
        }
    }

    const body = document.createElement('div');
    body.className = 'dsc-dv-body';
    const name = document.createElement('h3');
    name.className = 'dsc-dv-name';
    name.textContent = item.name;
    if (item.fav) {
        name.prepend(icon('star', 16));
    }
    const about = document.createElement('p');
    about.className = 'dsc-dv-about';
    about.textContent = item.about || t(item.kind === 'group' ? 'A place to hang out together.' : 'Say hi!');
    const foot = document.createElement('div');
    foot.className = 'dsc-dv-foot';
    const online = document.createElement('span');
    online.className = 'dsc-dv-online';
    if (item.kind === 'group') {
        online.textContent = `${item.members} ${t('Online')}`;
    } else {
        online.dataset.dscPresence = item.key;
        online.dataset.dscPresenceText = item.key;
    }
    const members = document.createElement('span');
    members.className = 'dsc-dv-members';
    members.textContent = item.kind === 'group' ? `${item.members} ${t('Members')}` : t(item.recent ? 'Recent' : 'Friend');
    foot.append(online, members);
    body.append(name, about, foot);

    const more = iconButton('dsc-dv-more', t('More'), 'more', 20);
    element.append(banner, iconBox, body, more);
    return element;
}

function build() {
    const sheld = document.getElementById('sheld');
    if (!sheld || document.getElementById(ID)) {
        return;
    }
    const page = document.createElement('div');
    page.id = ID;

    const hero = document.createElement('section');
    hero.className = 'dsc-dv-hero';
    const title = document.createElement('h1');
    title.textContent = t('Find your people on Discord');
    const subtitle = document.createElement('p');
    subtitle.textContent = t('Everyone you can talk to, and every server you\'ve made.');
    const search = document.createElement('label');
    search.className = 'dsc-dv-search';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = t('Explore characters and servers');
    input.addEventListener('input', () => {
        filter = input.value;
        render();
    });
    search.append(input, icon('search', 20));
    const actions = document.createElement('div');
    actions.className = 'dsc-dv-actions';
    const action = (label, iconName, run, primary = false) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `dsc-dv-action${primary ? ' dsc-dv-primary' : ''}`;
        button.append(icon(iconName, 18), document.createTextNode(t(label)));
        button.addEventListener('click', run);
        return button;
    };
    actions.append(
        action('New Character', 'person-add', () => openCharacterPanel('rm_button_create'), true),
        action('Import', 'upload', () => {
            openCharacterPanel('');
            document.getElementById('character_import_button')?.click();
        }),
        action('Import from URL', 'link', () => {
            openCharacterPanel('');
            document.getElementById('external_import_button')?.click();
        }),
        action('New Server', 'plus', () => openCharacterPanel('rm_button_group_chats')),
        // its own launcher hangs off SillyTavern's hidden Characters button
        ...(document.querySelector('#charlib-launcher-dropdown')
            ? [action('Character Library', 'friends', () => /** @type {HTMLElement|null} */ (document.querySelector('#charlib-launcher-dropdown [data-action="library"]'))?.click())]
            : []),
    );
    hero.append(title, subtitle, search, actions);

    const tabs = document.createElement('nav');
    tabs.className = 'dsc-dv-tabs';
    for (const [key, label] of [['all', 'All'], ['favorites', 'Favorites'], ['recent', 'Recent'], ['servers', 'Servers']]) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'dsc-dv-tab';
        tab.dataset.tab = key;
        tab.textContent = t(label);
        tab.addEventListener('click', () => {
            category = key;
            render();
        });
        tabs.append(tab);
    }

    const heading = document.createElement('h2');
    heading.className = 'dsc-dv-heading';
    const grid = document.createElement('div');
    grid.className = 'dsc-dv-grid';
    grid.addEventListener('click', (event) => {
        const target = /** @type {HTMLElement} */ (event.target);
        const element = /** @type {HTMLElement} */ (target.closest('.dsc-dv-card'));
        if (!element) {
            return;
        }
        const { kind, key } = element.dataset;
        if (target.closest('.dsc-dv-more')) {
            openMenu(/** @type {HTMLElement} */ (target.closest('.dsc-dv-more')), kind === 'group' ? [
                { label: 'Open', icon: 'chat', run: () => selectServer(key, true) },
                { label: 'Server Settings', icon: 'gear', run: () => editGroup(key) },
            ] : [
                { label: 'Message', icon: 'threads', run: () => openCharacter(key) },
                { label: 'Profile', icon: 'user', run: () => editCharacter(key) },
            ], 'below-end');
            return;
        }
        if (kind === 'group') {
            selectServer(key, true);
        } else {
            openCharacter(key);
        }
    });
    grid.addEventListener('keydown', (event) => {
        const element = /** @type {HTMLElement} */ (event.target).closest?.('.dsc-dv-card');
        if (element && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            /** @type {HTMLElement} */ (element).click();
        }
    });

    page.append(hero, tabs, heading, grid);
    sheld.append(page);
}

async function editCharacter(avatar) {
    await openCharacter(avatar);
    openCharacterPanel('');
    document.getElementById('rm_button_selected_ch')?.click();
}

async function editGroup(groupId) {
    const group = getServers().find(x => String(x.id) === String(groupId));
    await openPlace(latestChannel(group) ?? { group: groupId, avatar: '', fileId: '', fileName: '' });
    openCharacterPanel('');
    document.getElementById('rm_button_selected_ch')?.click();
}

export function render() {
    const page = document.getElementById(ID);
    if (!page) {
        return;
    }
    for (const tab of page.querySelectorAll('.dsc-dv-tab')) {
        tab.classList.toggle('dsc-selected', /** @type {HTMLElement} */ (tab).dataset.tab === category);
    }
    const needle = filter.trim().toLowerCase();
    let list = items();
    if (category === 'favorites') {
        list = list.filter(x => x.fav);
    } else if (category === 'recent') {
        list = list.filter(x => x.recent);
    } else if (category === 'servers') {
        list = list.filter(x => x.kind === 'group');
    }
    if (needle) {
        list = list.filter(x => x.name.toLowerCase().includes(needle) || x.about.toLowerCase().includes(needle));
    }
    const labels = { all: 'Featured', favorites: 'Favorites', recent: 'Recent', servers: 'Servers' };
    page.querySelector('.dsc-dv-heading').textContent = needle ? `${list.length} ${t('results')}` : t(labels[category]);
    const grid = page.querySelector('.dsc-dv-grid');
    grid.replaceChildren();
    const draw = (from) => {
        const cards = list.slice(from, from + PAGE).map(card);
        grid.append(...cards);
        for (const element of cards) {
            paintPresence(element);
            monogramizeAll(element, '.dsc-dv-icon .dsc-avatar img', img => img.parentElement?.dataset.name ?? '');
        }
        if (from + PAGE < list.length) {
            const sentinel = document.createElement('div');
            sentinel.className = 'dsc-dv-sentinel';
            grid.append(sentinel);
            const observer = new IntersectionObserver((entries) => {
                if (entries.some(entry => entry.isIntersecting)) {
                    observer.disconnect();
                    sentinel.remove();
                    draw(from + PAGE);
                }
            }, { root: page });
            observer.observe(sentinel);
        }
    };
    draw(0);
}

/** Shows Discover in the chat's place. */
export function showDiscover() {
    build();
    document.body.classList.add('dsc-discover');
    render();
    onShow();
}

export function hideDiscover() {
    document.body.classList.remove('dsc-discover');
}

/** @param {{shown: () => void}} options */
export function initDiscover(options) {
    onShow = options.shown;
    build();
    const { eventTypes } = SillyTavern.getContext();
    for (const type of [eventTypes.CHARACTER_EDITED, eventTypes.CHARACTER_DELETED, eventTypes.GROUP_UPDATED, eventTypes.CHARACTER_PAGE_LOADED]) {
        if (type) {
            onEvent(type, () => {
                if (document.body.classList.contains('dsc-discover')) {
                    render();
                }
            });
        }
    }
}
