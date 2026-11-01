// Discord's App Icons, the alternate logos Nitro offers: one picked on the Appearance page takes
// the place of the logo in the server rail, on the browser tab and on the loading screen. Only
// the list is here. The pictures load from Discord, and the one picked is kept on this server.

import { collectibleStore, saveCollectibles } from './collectibles.js';
import { saveFile } from './collectibles-offline.js';
import { setAppIcon } from './disguise.js';

const BASE = 'https://discord.com/assets/';
const REMEMBERED = 'dsc-app-icon';

export const APP_ICONS = [
    ['BRAND_DARK', 'Brand Dark', 'e8396e79419904ca'],
    ['MANGA', 'Manga', '2d62663c4b493f8e'],
    ['MATTE_DARK', 'Matte Dark', '28f89b5f78dd6f80'],
    ['MATTE_LIGHT', 'Matte Light', '96f9a2942150ba17'],
    ['PASTEL', 'Pastel', '22bb7108ad1c466f'],
    ['PIRATE', 'Pirate', '9af4b996c897420f'],
    ['CAMO', 'Camo', '9ad8ec824f71bd05'],
    ['SUNSET', 'Sunset', '5bf3279039efa66c'],
    ['GALAXY', 'Galaxy', '3a2d57c0bde9b218'],
    ['Y2K', 'Y2K', '181e40b5ea872cdb'],
    ['CHERRY_BLOSSOM', 'Cherry Blossom', '1e208c512641758d'],
    ['BEANIE', 'Beanie', 'e14578cc054054c0'],
    ['GAMING', 'Gaming', '5e5cc9b058e63987'],
    ['CIRCUIT', 'Circuit', '82c7a89d15622af4'],
    ['HOLO_WAVES', 'Holo Waves', '441d164362b711b1'],
    ['BLUSH', 'Blush', 'e5f2a55421a6dc7e'],
    ['ANGRY', 'Angry', '9b50f7ba00ee941f'],
    ['CONTROLLER', 'Controller', 'a629a2a3fe1ccbcc'],
    ['BLURPLE_TWILIGHT', 'Blurple Twilight', '685b2900a9423534'],
    ['IN_RAINBOWS', 'In Rainbows', '10cd104567438715'],
    ['MIDNIGHT_PRISM', 'Midnight Prism', '7ebbc1790864207a'],
    ['COLOR_WAVE', 'Color Wave', '7ce5a942a5cc7cba'],
].map(([id, name, file]) => ({ id, name, url: `${BASE}${file}.webp` }));

let settingsOf = () => /** @type {any} */ ({});
let save = () => {};

/** Where a picture loads from: its copy on this server, else through the Discord Decor plugin
 * (Discord's file, or the plugin's own copy when Discord refuses). A page can't load Discord's
 * file itself: browsers block it as another site's untyped file. */
export function appIconSource(icon) {
    const { saved } = collectibleStore();
    return saved[icon.url] ?? `/api/plugins/discord-decor/file?url=${encodeURIComponent(icon.url)}`;
}

export function currentAppIcon() {
    return settingsOf().appIcon ?? '';
}

/** Shows the picked logo everywhere it goes, or the usual one. */
export function applyAppIcon() {
    const icon = APP_ICONS.find(x => x.id === currentAppIcon());
    const wanted = icon ? appIconSource(icon) : '';
    if (!wanted) {
        showAppIcon('');
        return;
    }
    // only a picture that loads replaces the logo (it can't without the Decor plugin)
    const probe = new Image();
    probe.addEventListener('load', () => currentAppIcon() === icon.id && showAppIcon(wanted), { once: true });
    probe.addEventListener('error', () => currentAppIcon() === icon.id && showAppIcon(''), { once: true });
    probe.src = wanted;
}

function showAppIcon(source) {
    setAppIcon(source);
    const home = document.querySelector('.dsc-home button');
    home?.querySelector('.dsc-app-icon')?.remove();
    home?.classList.toggle('dsc-has-app-icon', !!source);
    if (source) {
        const img = document.createElement('img');
        img.className = 'dsc-app-icon';
        img.alt = '';
        img.src = source;
        home?.append(img);
    }
    try {
        source ? localStorage.setItem(REMEMBERED, source) : localStorage.removeItem(REMEMBERED);
    } catch {
        // the loading screen shows the usual logo
    }
    document.body.style.setProperty('--dsc-boot-logo', source ? `url("${source}")` : '');
}

/** The loading screen comes before the settings are read, so it uses the logo last shown. */
export function bootAppIcon() {
    try {
        const source = localStorage.getItem(REMEMBERED);
        if (source) {
            document.body.style.setProperty('--dsc-boot-logo', `url("${source}")`);
        }
    } catch {
        // the usual logo
    }
}

/** Picks a logo ('' for the usual one) and keeps a copy of it on this server. */
export async function pickAppIcon(id) {
    settingsOf().appIcon = id;
    save();
    applyAppIcon();
    const icon = APP_ICONS.find(x => x.id === id);
    if (icon && !collectibleStore().saved[icon.url] && await saveFile(icon.url)) {
        saveCollectibles();
        if (currentAppIcon() === id) {
            applyAppIcon();
        }
    }
}

export function initAppIcons({ getSettings, saveSettings }) {
    settingsOf = getSettings;
    save = saveSettings;
    applyAppIcon();
}
