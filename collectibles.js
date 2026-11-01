// Discord's profile collectibles on every character and persona: an avatar decoration around
// the picture, a nameplate behind the name in the DM and member lists, and a profile effect over
// the profile card. Each one gets its own, picked once from the least used and kept; the picker
// (Change Look on a profile) swaps them, and people can add their own pictures and videos.
//
// The built-in set is assets/collectibles/catalog.json; files people add are uploaded to
// SillyTavern's user files and listed in the settings with what they are.

import { openOffline, saveStarterSet } from './collectibles-offline.js';
import { GatedObserver, listen } from './life.js';
import { t } from './ui.js';

export const KINDS = /** @type {const} */ (['decoration', 'nameplate', 'effect', 'frame']);
/** What people may add: pictures (animated or not) and videos, which may be see-through */
const ACCEPT = 'image/png,image/apng,image/gif,image/webp,image/avif,video/webm,video/mp4,video/quicktime,.apng,.png,.gif,.webp,.avif,.webm,.mp4,.mov';
/** File types by extension, for systems that don't name a file's type (.apng often comes as '') */
const TYPES = { png: 'image/png', apng: 'image/apng', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', webm: 'video/webm', mp4: 'video/mp4', mov: 'video/quicktime' };
const BASE = new URL('./assets/collectibles/', import.meta.url).href;
/** Discord's public file server: the catalog lists files there, the theme keeps no copies */
const CDN = 'https://cdn.discordapp.com/';
const SHOP = `${CDN}media/v1/collectibles-shop/`;

/**
 * @typedef {{ src: string, loop: boolean, duration: number, start: number, delay: number, z: number, random: string[] }} EffectLayer
 * @typedef {{ url: string, type: 'staple'|'rail'|'border', order: 'front'|'back', anchor: 'top'|'bottom'|'center' }} FrameLayer
 * @typedef {{ id: string, name: string, url?: string, still?: string, video?: boolean, tint?: number[],
 *   layers?: EffectLayer[], frame?: { width: number, top: number, bottom: number, side: number, layers: FrameLayer[] } }} Item
 */

/** @type {{ decoration: Item[], nameplate: Item[], effect: Item[], frame: Item[] }} */
let catalog = { decoration: [], nameplate: [], effect: [], frame: [] };

let settingsOf = () => /** @type {any} */ ({});
let save = () => {};

function store() {
    const settings = settingsOf();
    settings.collectibles ??= {};
    settings.collectibles.assign ??= {};
    settings.collectibles.custom ??= [];
    settings.collectibles.saved ??= {};
    return settings.collectibles;
}

export { store as collectibleStore };

export function saveCollectibles() {
    save();
}

/** The built-in items of a kind. */
export function catalogOf(kind) {
    return catalog[kind];
}

/** Every file an item shows, by its address on Discord's server. */
export function filesOf(item) {
    if (item.frame) {
        return item.frame.layers.map(layer => layer.url);
    }
    if (item.layers) {
        return [item.still, ...item.layers.flatMap(layer => [layer.src, ...layer.random])].filter((url, i, all) => url && all.indexOf(url) === i);
    }
    return [item.still, item.url].filter(Boolean);
}

/** Where to load a file from: the saved copy on this server when there is one. Offline, Discord's
 * own address is never used. */
function local(url) {
    if (!url?.startsWith(CDN)) {
        return url;
    }
    const { saved, offline } = store();
    return saved[url] ?? (offline ? '' : url);
}

/** Whether an item can be shown: offline, only when every file of it is saved. */
function available(item) {
    if (!store().offline || item.id.startsWith('own-')) {
        return true;
    }
    const { saved } = store();
    return filesOf(item).every(url => saved[url]);
}

/** Every item of a kind: the built-in ones, then the ones people added. */
export function itemsOf(kind) {
    const custom = store().custom.filter(x => x.kind === kind);
    return [...catalog[kind].filter(available), ...custom];
}

let index = new Map();

function itemById(kind, id) {
    if (!id) {
        return null;
    }
    return index.get(`${kind}:${id}`) ?? store().custom.find(x => x.kind === kind && x.id === id) ?? null;
}
/** A character's or persona's key from a picture URL: c:<file> or p:<file>, or ''. */
export function keyOfPicture(src) {
    if (!src) {
        return '';
    }
    let url;
    try {
        url = new URL(src, location.href);
    } catch {
        return '';
    }
    const type = url.searchParams.get('type');
    const file = url.searchParams.get('file');
    if (url.pathname.endsWith('/thumbnail') && file) {
        return type === 'avatar' ? `c:${file}` : type === 'persona' ? `p:${file}` : '';
    }
    const path = decodeURIComponent(url.pathname);
    const match = /\/(characters|User Avatars)\/([^/]+)$/.exec(path);
    return match ? `${match[1] === 'characters' ? 'c' : 'p'}:${match[2]}` : '';
}

/** A small stable number for a key, to break ties the same way every time. */
function hashOf(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    }
    return hash >>> 0;
}

/** Someone's item of a kind; the first time, the least used one, which is then kept. */
export function itemFor(key, kind) {
    const assign = store().assign;
    const own = assign[key] ??= {};
    if (!Object.hasOwn(own, kind)) {
        const items = catalog[kind].filter(available);
        if (!items.length) {
            return null;
        }
        const used = new Map(items.map(x => [x.id, 0]));
        for (const other of Object.values(assign)) {
            if (used.has(other[kind])) {
                used.set(other[kind], used.get(other[kind]) + 1);
            }
        }
        const least = Math.min(...used.values());
        const free = items.filter(x => used.get(x.id) === least);
        own[kind] = free[hashOf(key) % free.length].id;
        save();
    }
    const item = itemById(kind, own[kind]);
    return item && available(item) ? item : null;
}

export function setItem(key, kind, id) {
    (store().assign[key] ??= {})[kind] = id;
    save();
    refreshAll();
}

/** A picture or a looping, silent video. */
function media(url, video, className) {
    if (video) {
        const element = document.createElement('video');
        element.className = className;
        element.src = local(url);
        element.muted = true;
        element.loop = true;
        element.autoplay = true;
        element.playsInline = true;
        element.setAttribute('aria-hidden', 'true');
        element.disablePictureInPicture = true;
        return element;
    }
    const img = document.createElement('img');
    img.className = className;
    img.src = local(url);
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.draggable = false;
    return img;
}

/** An item's first frame, or the item itself when it has none. */
function still(item, className) {
    return media(item.still ?? item.url, !item.still && !!item.video, className);
}

/** An item playing. */
function moving(item, className) {
    return media(item.url ?? item.still, !!item.video, className);
}

const calm = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- drawing them ---------- */

/** Round pictures that get a decoration: the theme's own and the ones in the chat */
const AVATARS = '.dsc-avatar, #chat .mes .avatar';
/** Rows that get a nameplate: direct messages and members */
const ROWS = '.dsc-dm, .dsc-member';
/** Profile cards that get an effect and a frame: the panel and the popout */
const PROFILES = '#dsc-aside:not(.dsc-members), #dsc-popout';

function pictureOf(holder) {
    const img = holder.querySelector(':scope > img, :scope > .dsc-avatar > img');
    return img?.getAttribute('src') ?? '';
}

function keyOfProfile(profile) {
    const avatar = profile.querySelector('.dsc-prof-avatar');
    return avatar ? keyOfPicture(pictureOf(avatar)) : '';
}

/** Puts an item's drawing in a holder, or takes it away; does nothing when it's already there. */
function swap(holder, selector, item, build, where = 'append') {
    const current = holder.querySelector(`:scope > ${selector}`);
    if ((current?.getAttribute('data-item') ?? '') === (item?.id ?? '')) {
        return;
    }
    current?.remove();
    if (item) {
        const drawn = build(item);
        drawn.setAttribute('data-item', item.id);
        holder[where](drawn);
    }
}

function decorate(holder) {
    const key = holder.closest('.dsc-dv-icon, .dsc-guild') ? '' : keyOfPicture(pictureOf(holder));
    // as in Discord: lists and the chat show the first frame and play while pointed at;
    // profiles play all the time
    const live = !!holder.closest(PROFILES) && !calm.matches;
    swap(holder, '.dsc-deco', key ? itemFor(key, 'decoration') : null, item => {
        const deco = live ? moving(item, 'dsc-deco') : still(item, 'dsc-deco');
        if (!live && item.still) {
            deco.setAttribute('data-dsc-play', '');
        }
        return deco;
    });
}

/** A nameplate: the palette's wash with the art over it, at its first frame until pointed at. */
function nameplate(item, live) {
    const holder = document.createElement('span');
    holder.className = 'dsc-plate';
    if (item.tint) {
        holder.style.setProperty('--dsc-plate-tint', item.tint.join(' '));
    }
    holder.append(live ? moving(item, 'dsc-plate-media') : still(item, 'dsc-plate-media'));
    if (!live && item.still) {
        holder.setAttribute('data-dsc-play', '');
    }
    return holder;
}

function plate(row) {
    const avatar = row.querySelector('.dsc-avatar');
    const key = avatar ? keyOfPicture(pictureOf(avatar)) : '';
    swap(row, '.dsc-plate', key ? itemFor(key, 'nameplate') : null, item => nameplate(item, false), 'prepend');
}

/** Plays what's under the pointer: decorations and nameplates show their first frame otherwise. */
function play(event) {
    const zone = /** @type {Element} */ (event.target).closest?.('.dsc-dm, .dsc-member, #chat .mes, .dsc-avatar');
    if (!zone || zone.contains(/** @type {Node} */ (event.relatedTarget)) || calm.matches) {
        return;
    }
    const on = event.type === 'pointerover';
    for (const deco of zone.querySelectorAll('img.dsc-deco[data-dsc-play]')) {
        const item = itemById('decoration', deco.getAttribute('data-item'));
        if (item) {
            /** @type {HTMLImageElement} */ (deco).src = local(on ? item.url : item.still);
        }
    }
    for (const holder of zone.querySelectorAll('.dsc-plate[data-dsc-play]')) {
        const item = itemById('nameplate', holder.getAttribute('data-item'));
        if (item) {
            holder.querySelector('.dsc-plate-media')?.replaceWith(on ? moving(item, 'dsc-plate-media') : still(item, 'dsc-plate-media'));
        }
    }
}

/**
 * A profile effect, played as Discord plays it: each layer is an animation shown from its start
 * time for its length; looping layers come back after their pause. Reduced motion shows the still.
 */
function effectLayer(item) {
    const box = document.createElement('div');
    box.className = 'dsc-effect';
    if (!item.layers || calm.matches) {
        box.append(item.layers ? still(item, 'dsc-effect-layer') : moving(item, 'dsc-effect-layer'));
        return box;
    }
    const born = performance.now();
    for (const layer of item.layers) {
        const show = () => {
            if (!box.isConnected && performance.now() - born > 1000) {
                return;
            }
            const src = layer.random.length ? layer.random[Math.floor(Math.random() * layer.random.length)] : layer.src;
            const img = media(src, false, 'dsc-effect-layer');
            img.loading = 'eager';
            img.style.zIndex = String(layer.z);
            box.append(img);
            setTimeout(() => {
                img.remove();
                if (layer.loop) {
                    setTimeout(show, layer.delay);
                }
            }, layer.duration);
        };
        setTimeout(show, layer.start);
    }
    return box;
}

function effect(profile) {
    const key = keyOfProfile(profile);
    swap(profile, '.dsc-effect', key ? itemFor(key, 'effect') : null, effectLayer);
}

/**
 * A profile frame, built as Discord builds it: staples (fixed art at the top or bottom, sticking
 * out past the card), and rails and borders (art repeated down the sides). Front layers go over
 * the card, back layers under it. Sizes are in the art's pixels, for a card frame.width wide.
 * `inside` keeps everything within the card, for the side panel, which has no room around it.
 */
function frameLayers(item, inside, only = '') {
    const box = document.createElement('div');
    box.className = 'dsc-frame';
    const f = item.frame;
    if (!f) {
        box.append(moving(item, 'dsc-frame-whole'));
        return box;
    }
    const total = f.width + 2 * f.side;
    if (!inside) {
        // the box sticks out past the card on both sides; margins in % are of the box's width
        box.style.left = box.style.right = `${(-100 * f.side) / f.width}%`;
    }
    for (const layer of f.layers) {
        if ((inside && layer.order === 'back') || (only && layer.order !== only)) {
            continue;
        }
        const part = layer.type === 'staple' ? media(layer.url, false, 'dsc-frame-staple') : document.createElement('div');
        part.classList.add(`dsc-frame-${layer.order}`, `dsc-frame-${layer.anchor}`);
        if (layer.type === 'staple') {
            /** @type {HTMLImageElement} */ (part).loading = 'eager';
            if (!inside) {
                const reach = layer.anchor === 'bottom' ? f.bottom : f.top;
                part.style[layer.anchor === 'bottom' ? 'marginBottom' : 'marginTop'] = `${(-100 * reach) / total}%`;
            }
        } else {
            part.className = `dsc-frame-rail dsc-frame-${layer.order} dsc-frame-${layer.anchor}`;
            part.style.backgroundImage = `url("${local(layer.url)}")`;
        }
        box.append(part);
    }
    return box;
}

/** The popout scrolls, so its frame can't live in it: it sits in the page, over it (front
 * layers) and under it (back layers), placed on it. */
let popFrames = [];
let popWatch = null;

function placePop(popout) {
    // offsets, not the drawn box: the popout grows in with a transform
    const place = { top: `${popout.offsetTop}px`, left: `${popout.offsetLeft}px`, width: `${popout.offsetWidth}px`, height: `${popout.offsetHeight}px` };
    popFrames.forEach(box => Object.assign(box.style, place));
}

function frame(profile) {
    const key = keyOfProfile(profile);
    const item = key ? itemFor(key, 'frame') : null;
    if (profile.id !== 'dsc-popout') {
        swap(profile, '.dsc-frame', item, it => frameLayers(it, true));
        const art = item?.frame;
        const total = art ? art.width + 2 * art.side : 1;
        profile.style.setProperty('--dsc-frame-top', art ? `${(100 * art.top) / total}%` : '0px');
        profile.style.setProperty('--dsc-frame-side', art ? `${(100 * art.side) / total}%` : '0px');
        return;
    }
    if ((popFrames[0]?.getAttribute('data-item') ?? '') === (item?.id ?? '') && popFrames[0]?.isConnected) {
        return;
    }
    dropPop();
    if (item) {
        popFrames = ['front', 'back'].map((order) => {
            const box = frameLayers(item, false, item.frame ? order : '');
            box.classList.add('dsc-frame-pop', `dsc-frame-pop-${order}`);
            box.setAttribute('data-item', item.id);
            return box;
        }).filter(box => box.childElementCount);
        placePop(profile);
        document.body.append(...popFrames);
        popWatch = new ResizeObserver(() => profile.isConnected ? placePop(profile) : dropPop());
        popWatch.observe(profile);
    }
}

function dropPop() {
    popWatch?.disconnect();
    popWatch = null;
    popFrames.forEach(box => box.remove());
    popFrames = [];
}

function paint(root) {
    if (!(root instanceof Element)) {
        return;
    }
    const each = (selector, draw) => {
        if (root.matches(selector)) {
            draw(root);
        }
        root.querySelectorAll(selector).forEach(draw);
    };
    each(AVATARS, decorate);
    each(ROWS, plate);
    each(PROFILES, effect);
    each(PROFILES, frame);
}

let pending = new Set();
let queued = false;

/** Paints what changed once per frame, however many changes came in. */
function schedule(node) {
    pending.add(node);
    if (!queued) {
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            const nodes = [...pending].filter(node => node.isConnected);
            pending = new Set();
            if (popFrames.length && !document.getElementById('dsc-popout')) {
                dropPop();
            }
            // a node inside another one in the batch is painted with it
            for (const node of nodes) {
                if (!nodes.some(other => other !== node && other.contains(node))) {
                    paint(node);
                }
            }
        });
    }
}

export function refreshAll() {
    schedule(document.body);
}

/** Draws everything again from scratch: after files were saved or deleted, or offline was turned on. */
export function redrawAll() {
    dropPop();
    document.querySelectorAll('.dsc-deco, .dsc-plate, .dsc-effect, .dsc-frame').forEach(drawn => drawn.remove());
    refreshAll();
}

/* ---------- people's own ---------- */

/** Uploads a picture or video to SillyTavern's user files and adds it to a kind's list. */
async function addOwn(kind, file) {
    const { getRequestHeaders } = SillyTavern.getContext();
    const extension = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
    const type = file.type || TYPES[extension] || '';
    if (!Object.values(TYPES).includes(type)) {
        toastr.warning(t('Use a PNG, APNG, GIF, WebP or AVIF picture, or a WebM or MP4 video.'));
        return null;
    }
    const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    const id = `own-${Date.now().toString(36)}`;
    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: `discord-${kind}-${id}.${extension || type.split('/')[1]}`, data }),
    });
    if (!response.ok) {
        toastr.error(t('That file could not be saved.'));
        return null;
    }
    const { path } = await response.json();
    const item = { id, kind, name: file.name.replace(/\.[^.]+$/, ''), url: path.startsWith('/') ? path : `/${path}`, video: type.startsWith('video/') };
    store().custom.push(item);
    save();
    return item;
}

async function removeOwn(item) {
    const { getRequestHeaders } = SillyTavern.getContext();
    const custom = store().custom;
    custom.splice(custom.indexOf(item), 1);
    for (const own of Object.values(store().assign)) {
        if (own[item.kind] === item.id) {
            delete own[item.kind];
        }
    }
    save();
    await fetch('/api/files/delete', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ path: item.url.replace(/^\//, '') }) }).catch(() => {});
    refreshAll();
}

/* ---------- the picker ---------- */

const PICKER_ID = 'dsc-look';
const TITLES = Object.fromEntries([['decoration', 'Avatar Decoration'], ['nameplate', 'Nameplate'], ['effect', 'Profile Effect'], ['frame', 'Profile Frame']]);

export function closeLook() {
    document.getElementById(PICKER_ID)?.remove();
}

/** Opens the picker for a character (c:<file>) or persona (p:<file>). */
export function openLook(key, name, picture) {
    closeLook();
    let kind = /** @type {typeof KINDS[number]} */ ('decoration');
    const layer = document.createElement('div');
    layer.id = PICKER_ID;
    layer.className = 'dsc-look-layer';
    const dialog = document.createElement('div');
    dialog.className = 'dsc-look';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', t('Change Look'));
    layer.append(dialog);
    layer.addEventListener('click', (event) => event.target === layer && closeLook());
    layer.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            closeLook();
        }
    });

    const head = document.createElement('header');
    head.className = 'dsc-look-head';
    const title = document.createElement('h2');
    title.textContent = t('Change Look');
    const who = document.createElement('div');
    who.className = 'dsc-look-who';
    who.textContent = name;
    const tabs = document.createElement('div');
    tabs.className = 'dsc-look-tabs';
    tabs.setAttribute('role', 'tablist');
    head.append(title, who, tabs);

    // a preview: the picture with its decoration, a nameplate row and the effect
    const preview = document.createElement('div');
    preview.className = 'dsc-look-preview';
    const grid = document.createElement('div');
    grid.className = 'dsc-look-grid';
    grid.setAttribute('role', 'listbox');

    const foot = document.createElement('footer');
    foot.className = 'dsc-look-foot';
    const upload = document.createElement('button');
    upload.type = 'button';
    upload.className = 'menu_button';
    upload.textContent = t('Add Your Own');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.hidden = true;
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'menu_button dsc-primary';
    done.textContent = t('Done');
    done.addEventListener('click', closeLook);
    const offline = document.createElement('button');
    offline.type = 'button';
    offline.className = 'menu_button dsc-look-offline';
    offline.textContent = t('Offline Copies');
    offline.addEventListener('click', () => {
        closeLook();
        openOffline();
    });
    foot.append(offline, upload, input, done);
    upload.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (file) {
            const item = await addOwn(kind, file);
            if (item) {
                setItem(key, kind, item.id);
                draw();
            }
        }
    });

    const find = document.createElement('input');
    find.type = 'search';
    find.className = 'text_pole dsc-look-find';
    find.placeholder = t('Search');
    find.addEventListener('input', () => fill());
    const list = document.createElement('div');
    list.className = 'dsc-look-list';
    list.append(find, grid);

    dialog.append(head, preview, list, foot);

    function drawPreview() {
        const own = store().assign[key] ?? {};
        const deco = itemById('decoration', own.decoration);
        const plateItem = itemById('nameplate', own.nameplate);
        const effectItem = itemById('effect', own.effect);
        const frameItem = itemById('frame', own.frame);
        const card = document.createElement('div');
        card.className = 'dsc-look-card';
        const avatar = document.createElement('span');
        avatar.className = 'dsc-look-avatar';
        const img = document.createElement('img');
        img.alt = '';
        img.src = picture;
        avatar.append(img);
        if (deco) {
            avatar.append(calm.matches ? still(deco, 'dsc-deco') : moving(deco, 'dsc-deco'));
        }
        const row = document.createElement('div');
        row.className = 'dsc-look-row';
        if (plateItem) {
            row.append(nameplate(plateItem, !calm.matches));
        }
        const label = document.createElement('span');
        label.className = 'dsc-look-name';
        label.textContent = name;
        row.append(label);
        card.append(avatar, row);
        if (effectItem) {
            card.append(effectLayer(effectItem));
        }
        if (frameItem) {
            card.append(frameLayers(frameItem, false));
        }
        preview.replaceChildren(card);
    }

    function tile(item) {
        const chosen = (store().assign[key]?.[kind] ?? '') === (item?.id ?? '');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dsc-look-tile';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(chosen));
        button.title = item ? item.name : t('None');
        if (item) {
            if (kind === 'decoration') {
                const sample = document.createElement('span');
                sample.className = 'dsc-look-sample';
                const img = document.createElement('img');
                img.alt = '';
                img.src = picture;
                img.loading = 'lazy';
                sample.append(img, still(item, 'dsc-deco'));
                button.append(sample);
            } else if (kind === 'nameplate') {
                button.append(nameplate(item, false));
            } else if (kind === 'frame' && item.frame) {
                const mini = document.createElement('span');
                mini.className = 'dsc-look-mini';
                mini.append(frameLayers(item, false));
                button.append(mini);
            } else {
                button.append(still(item, 'dsc-look-thumb'));
            }
            if (item.id.startsWith('own-')) {
                const remove = document.createElement('span');
                remove.className = 'dsc-look-remove';
                remove.setAttribute('role', 'button');
                remove.title = t('Remove');
                remove.textContent = '×';
                remove.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    await removeOwn(item);
                    draw();
                });
                button.append(remove);
            }
        } else {
            button.classList.add('dsc-look-none');
            button.textContent = t('None');
        }
        button.addEventListener('click', () => {
            setItem(key, kind, item?.id ?? '');
            for (const other of grid.querySelectorAll('.dsc-look-tile[aria-selected="true"]')) {
                other.setAttribute('aria-selected', 'false');
            }
            button.setAttribute('aria-selected', 'true');
            drawPreview();
        });
        return button;
    }

    // hundreds of items: tiles are made a page at a time, as the list is scrolled to its end
    const PAGE = 60;
    let shown = [];
    let made = 0;
    const more = new IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) {
            grow();
        }
    }, { root: grid, rootMargin: '400px' });
    const end = document.createElement('div');
    end.className = 'dsc-look-end';

    function grow() {
        const next = shown.slice(made, made + PAGE);
        made += next.length;
        end.before(...next.map(tile));
        if (made >= shown.length) {
            more.unobserve(end);
        }
    }

    function fill() {
        const words = find.value.trim().toLowerCase();
        shown = itemsOf(kind).filter(item => !words || item.name.toLowerCase().includes(words));
        made = 0;
        grid.replaceChildren(...(words ? [] : [tile(null)]), end);
        grid.scrollTop = 0;
        grow();
        more.observe(end);
    }

    function draw() {
        tabs.replaceChildren(...KINDS.map((each) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'dsc-look-tab';
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', String(each === kind));
            tab.setAttribute('data-kind', each);
            tab.textContent = t(TITLES[each]);
            tab.addEventListener('click', () => {
                kind = each;
                draw();
            });
            return tab;
        }));
        dialog.setAttribute('data-kind', kind);
        drawPreview();
        fill();
    }

    // make sure every kind has its pick before showing it
    KINDS.forEach(each => itemFor(key, each));
    document.body.append(layer);
    draw();
    done.focus();
}

/* ---------- start ---------- */

/** A catalog file: a path, a Discord file name (@ for assets/content) or a full address. */
function cdn(file) {
    return /^https?:/.test(file) ? file : file.startsWith('@') ? `${CDN}assets/content/${file.slice(1)}` : `${SHOP}${file}`;
}

/** Fills the catalog from assets/collectibles/catalog.json, which lists Discord's own as they are in its shop. */
async function loadCatalog() {
    try {
        const response = await fetch(`${BASE}catalog.json`);
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        const tints = data.palettes ?? {};
        catalog = {
            decoration: (data.decoration ?? []).map(([sku, name, asset]) => ({
                id: `d${sku}`,
                name,
                // the first frame comes small and light; the animation only as Discord sends it
                still: `${CDN}avatar-decoration-presets/${asset}.webp?size=96&passthrough=false`,
                url: `${CDN}avatar-decoration-presets/${asset}.png?size=96&passthrough=true`,
            })),
            nameplate: (data.nameplate ?? []).map(([sku, name, asset, palette]) => ({
                id: `n${sku}`,
                name,
                still: `${CDN}assets/collectibles/${asset}static.png`,
                url: `${CDN}assets/collectibles/${asset}asset.webm`,
                video: true,
                tint: tints[palette],
            })),
            effect: (data.effect ?? []).map(([sku, name, still, layers]) => ({
                id: `e${sku}`,
                name,
                still: cdn(still),
                layers: layers.map(([src, loop, duration, start, delay, z, random]) => ({
                    src: cdn(src), loop: !!loop, duration, start, delay, z, random: random.map(cdn),
                })),
            })),
            frame: (data.frame ?? []).map(([sku, name, item, width, top, bottom, side, layers]) => ({
                id: `f${sku}`,
                name,
                frame: {
                    width, top, bottom, side,
                    layers: layers.map(([id, type, order, anchor]) => ({ url: `${SHOP}${item}/${id}/static`, type, order, anchor })),
                },
            })),
        };
        index = new Map(KINDS.flatMap(kind => catalog[kind].map(item => [`${kind}:${item.id}`, item])));
    } catch (error) {
        console.warn('[Discord] No collectibles catalog', error);
    }
}

export async function initCollectibles({ getSettings, saveSettings }) {
    settingsOf = getSettings;
    save = saveSettings;
    await loadCatalog();
    refreshAll();
    // once the lists are drawn, so the people on screen have their items
    setTimeout(() => document.body.classList.contains('discord-theme') && saveStarterSet(), 5000);
    // Discord refused a picture or video: the Discord Decor plugin can get it from elsewhere
    listen(document, 'error', (event) => {
        const element = /** @type {HTMLImageElement} */ (event.target);
        if ((element.src?.startsWith(CDN) || element.src?.startsWith('https://discord.com/assets/')) && !store().offline) {
            element.src = `/api/plugins/discord-decor/file?url=${encodeURIComponent(element.src)}`;
        }
    }, true);
    listen(document, 'pointerover', play);
    listen(document, 'pointerout', play);
    new GatedObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                const holder = /** @type {Element} */ (mutation.target).closest(AVATARS);
                if (holder) {
                    schedule(holder.closest(ROWS) ?? holder.closest(PROFILES) ?? holder);
                }
                continue;
            }
            for (const node of mutation.addedNodes) {
                if (node instanceof Element && !node.closest('.dsc-deco, .dsc-plate, .dsc-effect, .dsc-frame, .dsc-look-layer')) {
                    // a profile redrawn inside: the profile gets its effect and frame back
                    schedule(node.parentElement?.closest(PROFILES) ?? node);
                }
            }
        }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
}
