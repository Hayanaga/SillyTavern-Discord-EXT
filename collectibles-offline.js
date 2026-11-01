// Offline copies of Discord's collectibles: people choose which ones to keep on their
// SillyTavern server (every kind, a kind, the ones in use, or item by item), and can turn off
// loading anything from Discord. Files are saved to SillyTavern's user files; the settings map
// each Discord address to its copy.
//
// Discord's file server lets pages on other sites read only some of its files (decorations).
// The rest come through the Discord Decor server plugin when it's installed, otherwise through
// SillyTavern's own CORS proxy, which is off unless config.yaml has enableCorsProxy: true.

import { KINDS, catalogOf, collectibleStore, filesOf, redrawAll, saveCollectibles } from './collectibles.js';
import { t } from './ui.js';

const DIALOG_ID = 'dsc-offline';
const TITLES = Object.fromEntries([['decoration', 'Avatar Decorations'], ['nameplate', 'Nameplates'], ['effect', 'Profile Effects'], ['frame', 'Profile Frames']]);
/** Rough sizes of a file of each kind, for the breakdown before anything is saved */
const TYPICAL = { decoration: 760_000, nameplate: 50_000, effect: 2_000_000, frame: 100_000 };
const PLUGIN = '/api/plugins/discord-decor';
/** How many items of each kind the starter set holds, besides the ones in use */
const STARTER_ITEMS = 6;

/** Whether the Discord Decor server plugin is installed. */
let pluginCheck = null;
function hasPlugin() {
    pluginCheck ??= fetch(`${PLUGIN}/status`).then(response => response.ok, () => false);
    return pluginCheck;
}

/** A short name for a saved copy: the file's address hashed, with its type. */
function nameFor(url, type) {
    let hash = 2166136261;
    for (let i = 0; i < url.length; i++) {
        hash = Math.imul(hash ^ url.charCodeAt(i), 16777619);
    }
    const extension = type.includes('webm') ? 'webm' : type.includes('webp') ? 'webp' : 'png';
    return `discord-cdn-${(hash >>> 0).toString(36)}-${url.length.toString(36)}.${extension}`;
}

/** Fetches a file of Discord's: through the plugin, straight, or through SillyTavern's proxy. */
async function grab(url) {
    if (await hasPlugin()) {
        const { getRequestHeaders } = SillyTavern.getContext();
        const response = await fetch(`${PLUGIN}/fetch`, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ url }) }).catch(() => null);
        if (response?.ok) {
            return await response.blob();
        }
    }
    for (const address of [url, `/proxy/${url}`]) {
        try {
            const response = await fetch(address);
            if (response.ok) {
                return await response.blob();
            }
        } catch {
            // next way
        }
    }
    return null;
}

async function keep(url, blob) {
    const { getRequestHeaders } = SillyTavern.getContext();
    const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: nameFor(url, blob.type || url), data }),
    });
    if (!response.ok) {
        return null;
    }
    const { path } = await response.json();
    return path.startsWith('/') ? path : `/${path}`;
}

async function forget(path) {
    const { getRequestHeaders } = SillyTavern.getContext();
    await fetch('/api/files/delete', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ path: path.replace(/^\//, '') }) }).catch(() => {});
}

function megabytes(bytes) {
    return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

/** Downloads the starter set once, when the plugin is there: what's in use and the first few of
 * each kind. Nothing starts by itself while only saved copies are allowed. */
export async function saveStarterSet() {
    const store = collectibleStore();
    if (store.starterDone || store.offline || !await hasPlugin()) {
        return;
    }
    const inUse = new Set(Object.values(store.assign).flatMap(own => Object.values(own)));
    const items = KINDS.flatMap(kind => catalogOf(kind).filter((item, i) => i < STARTER_ITEMS || inUse.has(item.id)));
    const queue = [...new Set(items.flatMap(filesOf))].filter(url => !store.saved[url]);
    const work = async () => {
        while (queue.length) {
            const url = queue.shift();
            const blob = await grab(url);
            const path = blob && await keep(url, blob);
            if (path) {
                store.saved[url] = path;
            }
        }
    };
    await Promise.all([work(), work(), work()]);
    store.starterDone = true;
    saveCollectibles();
    redrawAll();
}

/** Keeps one file of Discord's on this server. Says whether it could. */
export async function saveFile(url) {
    const blob = await grab(url);
    const path = blob && await keep(url, blob);
    if (path) {
        collectibleStore().saved[url] = path;
    }
    return !!path;
}

export function closeOffline() {
    document.getElementById(DIALOG_ID)?.remove();
}

/** Opens Offline Copies. */
export function openOffline() {
    closeOffline();
    const store = collectibleStore();
    const isSaved = item => filesOf(item).every(url => store.saved[url]);
    const inUse = new Set(Object.values(store.assign).flatMap(own => Object.values(own)));
    /** what's ticked: what's saved and what's in use */
    const chosen = new Set(KINDS.flatMap(kind => catalogOf(kind).filter(item => isSaved(item) || inUse.has(item.id)).map(item => item.id)));
    let busy = false;

    const layer = document.createElement('div');
    layer.id = DIALOG_ID;
    layer.className = 'dsc-look-layer';
    const dialog = document.createElement('div');
    dialog.className = 'dsc-offline';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', t('Offline Copies'));
    layer.append(dialog);
    layer.addEventListener('click', event => event.target === layer && !busy && closeOffline());
    layer.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !busy) {
            event.stopPropagation();
            closeOffline();
        }
    });

    const head = document.createElement('header');
    head.className = 'dsc-look-head';
    const title = document.createElement('h2');
    title.textContent = t('Offline Copies');
    const about = document.createElement('p');
    about.className = 'dsc-offline-about';
    about.textContent = t('Keep copies of Discord\'s art on this SillyTavern server, so it doesn\'t need the internet to show them.');
    const only = document.createElement('label');
    only.className = 'checkbox_label dsc-offline-only';
    const onlyBox = document.createElement('input');
    onlyBox.type = 'checkbox';
    onlyBox.checked = !!store.offline;
    onlyBox.addEventListener('change', () => {
        store.offline = onlyBox.checked;
        saveCollectibles();
        redrawAll();
    });
    only.append(onlyBox, t('Use only saved copies (never load from Discord)'));
    head.append(title, about, only);

    const body = document.createElement('div');
    body.className = 'dsc-offline-body';

    const foot = document.createElement('footer');
    foot.className = 'dsc-look-foot';
    const status = document.createElement('div');
    status.className = 'dsc-offline-status';
    status.setAttribute('role', 'status');
    const inUseButton = button(t('Only the Ones in Use'), () => {
        chosen.clear();
        KINDS.forEach(kind => catalogOf(kind).filter(item => inUse.has(item.id)).forEach(item => chosen.add(item.id)));
        drawBody();
    });
    const remove = button(t('Delete Unticked'), () => run('delete'));
    const download = button(t('Download'), () => run('download'), 'dsc-primary');
    const close = button(t('Close'), closeOffline);
    foot.append(status, inUseButton, remove, download, close);
    dialog.append(head, body, foot);

    function button(label, onClick, extra = '') {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = `menu_button ${extra}`.trim();
        element.textContent = label;
        element.addEventListener('click', onClick);
        return element;
    }

    /** The plan: what's ticked and not saved yet, and what's saved and not ticked. */
    function plan() {
        const fetch = [];
        const drop = [];
        let bytes = 0;
        for (const kind of KINDS) {
            for (const item of catalogOf(kind)) {
                const missing = filesOf(item).filter(url => !store.saved[url]);
                if (chosen.has(item.id) && missing.length) {
                    fetch.push(...missing);
                    bytes += missing.length * TYPICAL[kind];
                } else if (!chosen.has(item.id)) {
                    drop.push(...filesOf(item).filter(url => store.saved[url]));
                }
            }
        }
        // a file shared with a ticked item stays
        const kept = new Set(KINDS.flatMap(kind => catalogOf(kind).filter(item => chosen.has(item.id)).flatMap(filesOf)));
        return { fetch: [...new Set(fetch)], drop: [...new Set(drop)].filter(url => !kept.has(url)), bytes };
    }

    function drawStatus(text = '') {
        const { fetch, drop, bytes } = plan();
        status.textContent = text || [
            fetch.length ? t('To download: about {0}').replace('{0}', megabytes(bytes)) : t('Everything ticked is saved.'),
            drop.length ? t('{0} saved files are unticked.').replace('{0}', String(drop.length)) : '',
        ].filter(Boolean).join(' ');
        download.disabled = busy || !fetch.length;
        remove.disabled = busy || !drop.length;
    }

    function drawBody() {
        body.replaceChildren(...KINDS.map(section));
        drawStatus();
    }

    /** A kind: tick all of it, its count and size, and its items to tick one by one. */
    function section(kind) {
        const items = catalogOf(kind);
        const ticked = items.filter(item => chosen.has(item.id));
        const saved = items.filter(isSaved).length;
        const files = items.reduce((sum, item) => sum + filesOf(item).length, 0);
        const details = document.createElement('details');
        details.className = 'dsc-offline-kind';
        const summary = document.createElement('summary');
        const all = document.createElement('input');
        all.type = 'checkbox';
        all.checked = ticked.length === items.length && items.length > 0;
        all.indeterminate = ticked.length > 0 && ticked.length < items.length;
        all.setAttribute('aria-label', t(TITLES[kind]));
        all.addEventListener('click', event => event.stopPropagation());
        all.addEventListener('change', () => {
            items.forEach(item => all.checked ? chosen.add(item.id) : chosen.delete(item.id));
            drawBody();
        });
        const name = document.createElement('span');
        name.className = 'dsc-offline-name';
        name.textContent = t(TITLES[kind]);
        const count = document.createElement('span');
        count.className = 'dsc-offline-count';
        count.textContent = t('{0} of {1} ticked, {2} saved, all about {3}')
            .replace('{0}', String(ticked.length)).replace('{1}', String(items.length))
            .replace('{2}', String(saved)).replace('{3}', megabytes(files * TYPICAL[kind]));
        summary.append(all, name, count);
        details.append(summary);
        // the list is made when opened: hundreds of rows
        details.addEventListener('toggle', () => {
            if (!details.open || details.querySelector('.dsc-offline-list')) {
                return;
            }
            const find = document.createElement('input');
            find.type = 'search';
            find.className = 'text_pole dsc-offline-find';
            find.placeholder = t('Search');
            const list = document.createElement('div');
            list.className = 'dsc-offline-list';
            const rows = items.map((item) => {
                const row = document.createElement('label');
                row.className = 'checkbox_label dsc-offline-row';
                const box = document.createElement('input');
                box.type = 'checkbox';
                box.checked = chosen.has(item.id);
                box.addEventListener('change', () => {
                    box.checked ? chosen.add(item.id) : chosen.delete(item.id);
                    const now = items.filter(x => chosen.has(x.id)).length;
                    all.checked = now === items.length;
                    all.indeterminate = now > 0 && now < items.length;
                    count.textContent = t('{0} of {1} ticked, {2} saved, all about {3}')
                        .replace('{0}', String(now)).replace('{1}', String(items.length))
                        .replace('{2}', String(saved)).replace('{3}', megabytes(files * TYPICAL[kind]));
                    drawStatus();
                });
                const label = document.createElement('span');
                label.textContent = item.name;
                row.append(box, label);
                if (isSaved(item)) {
                    const mark = document.createElement('span');
                    mark.className = 'dsc-offline-saved';
                    mark.textContent = t('Saved');
                    row.append(mark);
                }
                row.dataset.name = item.name.toLowerCase();
                return row;
            });
            list.append(...rows);
            find.addEventListener('input', () => {
                const words = find.value.trim().toLowerCase();
                rows.forEach(row => { row.style.display = words && !row.dataset.name.includes(words) ? 'none' : ''; });
            });
            details.append(find, list);
        });
        return details;
    }

    async function run(what) {
        const { fetch, drop } = plan();
        busy = true;
        drawStatus();
        let done = 0;
        let failed = 0;
        const total = what === 'download' ? fetch.length : drop.length;
        const queue = what === 'download' ? [...fetch] : [...drop];
        const work = async () => {
            while (queue.length && layer.isConnected) {
                const url = queue.shift();
                if (what === 'download') {
                    const blob = await grab(url);
                    const path = blob && await keep(url, blob);
                    path ? (store.saved[url] = path) : failed++;
                } else {
                    await forget(store.saved[url]);
                    delete store.saved[url];
                }
                done++;
                if (done % 10 === 0 || done === total) {
                    saveCollectibles();
                }
                status.textContent = `${what === 'download' ? t('Downloading') : t('Deleting')} ${done} / ${total}`;
            }
        };
        await Promise.all([work(), work(), work()]);
        saveCollectibles();
        busy = false;
        redrawAll();
        drawBody();
        if (failed) {
            drawStatus(t('{0} files could not be downloaded. Most of Discord\'s files need the Discord Decor server plugin, or SillyTavern\'s CORS proxy: set enableCorsProxy: true in config.yaml and restart SillyTavern.').replace('{0}', String(failed)));
        }
    }

    drawBody();
    document.body.append(layer);
    close.focus();
}
