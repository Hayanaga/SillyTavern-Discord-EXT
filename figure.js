// The character's picture in the profile pane and the server deck: whatever SillyTavern is
// showing of them right now, in this order:
// 0. a picture from their gallery, while it's open in SillyTavern's gallery viewer;
// 1. their current expression sprite (Character Expressions), live as it changes;
// 2. a cutout of their picture without its background, made once by the Background Removal
//    server plugin (github.com/pervertir/SillyTavern-BackgroundRemoval) when it's installed
//    and saved to their gallery as "<picture>-cutout-<time>.png", the plugin's own naming,
//    so cutouts made with the plugin's button count too;
// 3. their profile picture.

import { chatLook } from './chatlook.js';
import { GatedObserver } from './life.js';
import { isPlaceholder } from './monograms.js';
import { fullPictureUrl } from './ui.js';

const PLUGIN = '/api/plugins/background-removal';

/** avatar file -> Promise of the cutout's address, or '' */
const cutouts = new Map();
/** avatar file -> the cutout's address, once known */
const ready = new Map();
let plugin = null;

function headers() {
    return SillyTavern.getContext().getRequestHeaders();
}

/** The newest picture from the character's gallery open in the gallery viewer, or ''. */
function galleryOf(character) {
    const folder = `/images/${character.name}/`;
    const open = [...document.querySelectorAll('#movingDivs > .galleryImageDraggable')]
        .filter(box => /** @type {HTMLElement} */ (box).style.display !== 'none')
        .map(box => box.querySelector('img')?.getAttribute('src') ?? '')
        .filter((src) => {
            try {
                return decodeURIComponent(src).includes(folder);
            } catch {
                return false;
            }
        });
    return open.at(-1) ?? '';
}

/** The sprite on screen for a character, or ''. Emoji stand-ins don't count. */
function spriteOf(character) {
    const { characters, characterId, groupId } = SillyTavern.getContext();
    const images = [...document.querySelectorAll('#visual-novel-wrapper .expression-holder[data-avatar] img.expression')]
        .filter(img => img.closest('[data-avatar]')?.getAttribute('data-avatar') === character.avatar);
    if (!groupId && characters[characterId]?.avatar === character.avatar) {
        const solo = document.getElementById('expression-image');
        if (solo) {
            images.push(solo);
        }
    }
    const shown = images.find(img => img.getAttribute('src') && !img.classList.contains('default'));
    return shown?.getAttribute('src') ?? '';
}

function pluginReady() {
    plugin ??= fetch(`${PLUGIN}/status`, { headers: headers() })
        .then(response => response.ok ? response.json() : null)
        .then(status => !!status && status.status !== 'error')
        .catch(() => false);
    return plugin;
}

function baseName(avatar) {
    return avatar.replace(/\.[^.]+$/, '');
}

async function savedCutout(character) {
    const response = await fetch('/api/images/list', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ folder: character.name, sortField: 'date', sortOrder: 'desc' }),
    });
    const files = response.ok ? await response.json() : [];
    const prefix = `${baseName(character.avatar)}-cutout-`;
    const file = (Array.isArray(files) ? files : []).find(name => typeof name === 'string' && name.startsWith(prefix));
    return file ? `user/images/${encodeURIComponent(character.name)}/${encodeURIComponent(file)}` : '';
}

async function makeCutout(character) {
    const picture = await fetch(fullPictureUrl('avatar', character.avatar));
    if (!picture.ok) {
        return '';
    }
    const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        picture.blob().then(blob => reader.readAsDataURL(blob), reject);
    });
    const removed = await fetch(`${PLUGIN}/remove`, { method: 'POST', headers: headers(), body: JSON.stringify({ image }) });
    const data = removed.ok ? await removed.json() : {};
    if (!data.image) {
        return '';
    }
    const upload = await fetch('/api/images/upload', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ image: data.image, format: 'png', filename: `${baseName(character.avatar)}-cutout-${Date.now()}`, ch_name: character.name }),
    });
    const saved = upload.ok ? await upload.json() : {};
    return saved.path ? String(saved.path).split('/').map(encodeURIComponent).join('/') : '';
}

/** The character's cutout: a saved one, else a new one if the plugin is there; '' if neither. */
function cutoutOf(character) {
    if (!cutouts.has(character.avatar)) {
        cutouts.set(character.avatar, (async () => {
            if (await isPlaceholder(SillyTavern.getContext().getThumbnailUrl('avatar', character.avatar))) {
                return '';
            }
            const saved = await savedCutout(character).catch(() => '');
            if (saved || !(await pluginReady())) {
                return saved;
            }
            return makeCutout(character).catch(() => '');
        })().then((url) => {
            if (url) {
                ready.set(character.avatar, url);
            }
            return url;
        }));
    }
    return cutouts.get(character.avatar);
}

/** Shows the best picture of the character in the card's image. */
function paint(card, character) {
    const img = card.querySelector('img');
    const chosen = chatLook(`c:${character.avatar}`).picture;
    const figure = chosen ? '' : galleryOf(character) || spriteOf(character) || ready.get(character.avatar) || '';
    const src = chosen || figure || fullPictureUrl('avatar', character.avatar);
    card.classList.toggle('dsc-figure-cut', !!figure);
    if (img && img.getAttribute('src') !== src) {
        img.src = src;
    }
}

/**
 * Fills a picture card with the character's best picture and keeps it current. `gone` is
 * called if the card is dropped because the character has no picture at all.
 */
export function fillFigure(card, character, gone = () => {}) {
    card.dataset.dscFigure = character.avatar;
    paint(card, character);
    cutoutOf(character).then((url) => {
        if (url && card.isConnected) {
            paint(card, character);
        }
    });
    isPlaceholder(SillyTavern.getContext().getThumbnailUrl('avatar', character.avatar)).then((placeholder) => {
        if (placeholder && !card.classList.contains('dsc-figure-cut')) {
            card.remove();
            gone();
        }
    });
    watch();
}

let watching = false;

/** Repaints the cards when a sprite changes or a gallery picture opens or closes. */
function watch() {
    if (watching) {
        return;
    }
    watching = true;
    let queued = false;
    const observer = new GatedObserver((records) => {
        const relevant = records.some((record) => {
            const target = /** @type {Element} */ (record.target);
            return record.type === 'childList' || target.classList?.contains('expression') || Boolean(target.closest?.('#movingDivs'));
        });
        if (queued || !relevant) {
            return;
        }
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            const { characters } = SillyTavern.getContext();
            for (const card of document.querySelectorAll('[data-dsc-figure]')) {
                const character = characters.find(x => x.avatar === card.getAttribute('data-dsc-figure'));
                if (character) {
                    paint(/** @type {HTMLElement} */ (card), character);
                }
            }
        });
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['src', 'class'] });
    const viewer = document.getElementById('movingDivs');
    if (viewer) {
        observer.observe(viewer, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'src'] });
    }
}
