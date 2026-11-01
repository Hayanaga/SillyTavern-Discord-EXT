// Customize: every part of the theme can be changed from Settings > Customize, live, with a
// preview at the top. Each option is a CSS variable (css/custom-hooks.css reads them, each
// falling back to the theme's own value) or a flag, kept in one object in the theme's
// settings and applied through one generated stylesheet on top of whichever base or Nitro
// theme is chosen. Sections can be reset one at a time or all at once, and the whole set
// exports to and imports from a JSON file. The shared shape is in
// /Volumes/980Pro/Workspace/AI/shared/customize-spec.md.

import { escapeHtml, t } from './ui.js';

const STYLE_ID = 'dsc-custom-style';
const PAGE_ID = 'dsc-customize';
const VERSION = 1;
const THEME_ID = 'discord';

/** The sections and their options. A token is a CSS variable; a flag is anything else. */
const SECTIONS = [
    {
        id: 'colors', title: 'Colors', fields: [
            { token: '--dsc-blurple', label: 'Accent', type: 'color' },
            { token: '--dsc-rail', label: 'Server rail and title bar', type: 'color' },
            { token: '--dsc-side', label: 'Sidebar and member list', type: 'color' },
            { token: '--dsc-chat', label: 'Chat', type: 'color' },
            { token: '--dsc-panel', label: 'Your panel', type: 'color' },
            { token: '--dsc-surface', label: 'Cards, dialogs and tooltips', type: 'color' },
            { token: '--dsc-floating', label: 'Menus', type: 'color' },
            { token: '--dsc-input', label: 'Message box', type: 'color' },
            { token: '--dsc-field', label: 'Fields', type: 'color' },
            { token: '--dsc-header', label: 'Headings and names', type: 'color' },
            { token: '--dsc-text', label: 'Text', type: 'color' },
            { token: '--dsc-muted', label: 'Muted text', type: 'color' },
            { token: '--dsc-link', label: 'Links', type: 'color' },
            { token: '--dsc-hover', label: 'Hover fill', type: 'color' },
            { token: '--dsc-selected', label: 'Selected fill', type: 'color' },
            { token: '--dsc-online', label: 'Online', type: 'color' },
            { token: '--dsc-red', label: 'Danger', type: 'color' },
        ],
    },
    {
        id: 'text', title: 'Text', fields: [
            { token: '--dsc-font', label: 'Font', type: 'font', note: 'Any font installed on this computer, by name, e.g. Inter or system-ui.' },
            { token: '--mainFontSize', label: 'Interface text size', type: 'range', min: 12, max: 20, step: 1, unit: 'px', base: 16 },
            { token: '--dsc-chat-font', label: 'Chat text size', type: 'range', min: 12, max: 24, step: 1, unit: 'px', base: 16 },
            { token: '--dsc-line', label: 'Message line height', type: 'range', min: 1.1, max: 1.8, step: 0.05, unit: '', base: 1.375 },
            { token: '--dsc-name-weight', label: 'Name weight', type: 'range', min: 300, max: 800, step: 100, unit: '', base: 500 },
            { token: '--dsc-body-weight', label: 'Message weight', type: 'range', min: 300, max: 600, step: 100, unit: '', base: 400 },
        ],
    },
    {
        id: 'shape', title: 'Shape', fields: [
            { flag: 'avatarShape', label: 'Picture shape', type: 'select', options: [['round', 'Round'], ['squircle', 'Rounded square'], ['square', 'Square']], base: 'round' },
            { token: '--dsc-chat-avatar', label: 'Picture size in chat', type: 'range', min: 24, max: 64, step: 2, unit: 'px', base: 40 },
            { token: '--dsc-radius-button', label: 'Buttons', type: 'range', min: 0, max: 20, step: 1, unit: 'px', base: 8 },
            { token: '--dsc-radius-input', label: 'Fields and message box', type: 'range', min: 0, max: 24, step: 1, unit: 'px', base: 8 },
            { token: '--dsc-radius-card', label: 'Cards and rows', type: 'range', min: 0, max: 20, step: 1, unit: 'px', base: 8 },
            { token: '--dsc-radius-modal', label: 'Dialogs', type: 'range', min: 0, max: 28, step: 1, unit: 'px', base: 12 },
            { token: '--dsc-radius-image', label: 'Pictures and code', type: 'range', min: 0, max: 24, step: 1, unit: 'px', base: 8 },
        ],
    },
    {
        id: 'spacing', title: 'Spacing', fields: [
            { flag: 'density', label: 'Density', type: 'select', options: [['compact', 'Compact'], ['default', 'Default'], ['roomy', 'Roomy']], base: 'default' },
            { token: '--dsc-rail-w', label: 'Server rail width', type: 'range', min: 56, max: 100, step: 2, unit: 'px', base: 76 },
            { token: '--dsc-side-w', label: 'Sidebar width', type: 'range', min: 200, max: 480, step: 4, unit: 'px', base: 240 },
            { token: '--dsc-members-w', label: 'Member list width', type: 'range', min: 200, max: 480, step: 4, unit: 'px', base: 264 },
            { token: '--dsc-profile-w', label: 'Profile panel width', type: 'range', min: 260, max: 600, step: 4, unit: 'px', base: 340 },
        ],
    },
    {
        id: 'layout', title: 'Layout', note: 'Show or hide parts of the screen.', fields: [
            ['nitroRow', 'Nitro row'], ['shopRow', 'Shop row'], ['railAdd', 'Add a Server'], ['railDiscover', 'Discover'],
            ['toolCall', 'Header: new chat (phone)'], ['toolVideo', 'Header: chat history (camera)'], ['toolThreads', 'Header: chat history (threads)'],
            ['toolPin', 'Header: pin'], ['toolAdd', 'Header: convert to group'], ['toolProfile', 'Header: profile toggle'], ['toolMembers', 'Header: member list toggle'],
            ['toolSearch', 'Header: search'], ['titleInbox', 'Title bar: inbox'], ['titleHelp', 'Title bar: help'],
            ['userMute', 'Your panel: mute'], ['userDeafen', 'Your panel: deafen'],
            ['composeGift', 'Message box: gift'], ['composeGif', 'Message box: GIF'], ['composeSticker', 'Message box: sticker'], ['composeApps', 'Message box: apps'],
            ['typing', 'Typing indicator'], ['timestamps', 'Message times'], ['dateDividers', 'Date lines'], ['unreadPill', 'Unread marks'],
        ].map(([key, label]) => ({ hide: key, label, type: 'show' })),
    },
    {
        id: 'messages', title: 'Messages', fields: [
            { token: '--dsc-name-color', label: 'Character names', type: 'color' },
            { token: '--dsc-own-name', label: 'Your name', type: 'color' },
            { token: '--dsc-own-bg', label: 'Highlight your messages', type: 'color' },
            { token: '--dsc-embed-w', label: 'Picture width limit', type: 'range', min: 200, max: 900, step: 10, unit: 'px', base: 550 },
            { token: '--dsc-embed-h', label: 'Picture height limit', type: 'range', min: 150, max: 700, step: 10, unit: 'px', base: 350 },
            { flag: 'nameColors', label: 'Name colours per character', type: 'names' },
        ],
    },
    {
        id: 'background', title: 'Chat Background', fields: [
            { flag: 'bgMode', label: 'Background', type: 'select', options: [['none', 'Theme colour'], ['color', 'Colour'], ['gradient', 'Gradient'], ['image', 'Picture']], base: 'none' },
            { flag: 'bgColor', label: 'Colour', type: 'color', base: '#1a1a1e', when: ['bgMode', 'color'] },
            { flag: 'bgFrom', label: 'Gradient from', type: 'color', base: '#5865f2', when: ['bgMode', 'gradient'] },
            { flag: 'bgTo', label: 'Gradient to', type: 'color', base: '#eb459f', when: ['bgMode', 'gradient'] },
            { flag: 'bgAngle', label: 'Gradient angle', type: 'range', min: 0, max: 360, step: 5, unit: 'deg', base: 160, when: ['bgMode', 'gradient'] },
            { flag: 'bgImage', label: 'Picture link', type: 'text', placeholder: 'https://… or /backgrounds/…', when: ['bgMode', 'image'] },
            { flag: 'bgBlur', label: 'Blur', type: 'range', min: 0, max: 30, step: 1, unit: 'px', base: 0, when: ['bgMode', 'image'] },
            { flag: 'bgDim', label: 'Dim', type: 'range', min: 0, max: 0.9, step: 0.05, unit: '', base: 0.4, when: ['bgMode', 'image'] },
        ],
    },
    {
        id: 'motion', title: 'Motion', fields: [
            { flag: 'motion', label: 'Animations', type: 'select', options: [['on', 'On'], ['reduced', 'Reduced'], ['off', 'Off']], base: 'on' },
            { token: '--dsc-typing-speed', label: 'Typing dots speed', type: 'range', min: 0.6, max: 3, step: 0.1, unit: 's', base: 1.4 },
        ],
    },
    {
        id: 'advanced', title: 'Advanced', fields: [
            { flag: 'css', label: 'Custom CSS', type: 'css', note: 'Applies only while the theme is on. Write rules as usual; they are scoped under body.discord-theme.' },
        ],
    },
];

const HIDE_SELECTORS = {
    nitroRow: '#dsc-side .dsc-nav-row[data-nav="nitro"]',
    shopRow: '#dsc-side .dsc-nav-row[data-nav="shop"]',
    railAdd: '#dsc-guilds .dsc-add',
    railDiscover: '#dsc-guilds .dsc-discover',
    toolCall: '#dsc-head .dsc-tool-call',
    toolVideo: '#dsc-head .dsc-tool-video',
    toolThreads: '#dsc-head .dsc-tool-threads',
    toolPin: '#dsc-head .dsc-tool-pin',
    toolAdd: '#dsc-head .dsc-tool-add',
    toolProfile: '#dsc-head .dsc-tool-profile',
    toolMembers: '#dsc-head .dsc-tool-members',
    toolSearch: '#dsc-head .dsc-head-search',
    titleInbox: '#dsc-titlebar .dsc-inbox',
    titleHelp: '#dsc-titlebar .dsc-help',
    userMute: '#dsc-user .dsc-mute',
    userDeafen: '#dsc-user .dsc-deafen',
    composeGift: '#dsc-compose-tools .dsc-compose-gift',
    composeGif: '#dsc-compose-tools .dsc-compose-gif',
    composeSticker: '#dsc-compose-tools .dsc-compose-sticker',
    composeApps: '#dsc-compose-tools .dsc-compose-apps',
    typing: '#dsc-typing',
    timestamps: '#chat .mes .timestamp',
    dateDividers: '#chat .mes[data-dsc-day]::before, #chat .mes[data-dsc-day]::after',
    unreadPill: '#dsc-side .dsc-dm.dsc-unread::before, #dsc-guilds .dsc-guild.dsc-unread .dsc-pill',
};

const AVATAR_RADIUS = { round: '50%', squircle: '30%', square: '4px' };
const DENSITY = {
    compact: { '--dsc-row-h': '34px', '--dsc-channel-h': '28px', '--dsc-mes-pad': '0px' },
    roomy: { '--dsc-row-h': '50px', '--dsc-channel-h': '38px', '--dsc-mes-pad': '5px' },
};

let getSettings = () => ({});
let save = () => {};

/*
 * The shared shape (the iMessage theme uses the same): settings.customize = { tokens, flags, css }.
 * tokens maps a CSS variable ('--dsc-…') to its value; flags maps a name to true or a string
 * ('hide-<part>': true, 'name:<character>': colour, the rest as their values); css is the custom
 * CSS. Export adds themeId and version.
 */
const HIDE = 'hide-';
const NAME = 'name:';

function empty() {
    return { tokens: {}, flags: {}, css: '' };
}

/** The customization object in the theme's settings, created on first use. */
function custom() {
    const settings = getSettings();
    settings.customize ??= empty();
    settings.customize.tokens ??= {};
    settings.customize.flags ??= {};
    settings.customize.css ??= '';
    return settings.customize;
}

/** The per-character name colours, from their flags. */
function nameColors(flags) {
    return Object.fromEntries(Object.entries(flags).filter(([key, value]) => key.startsWith(NAME) && typeof value === 'string').map(([key, value]) => [key.slice(NAME.length), value]));
}

/** A CSS value is kept only if it can't break out of its declaration. */
function safe(value) {
    return String(value ?? '').replace(/[;{}<>]/g, '').trim();
}

function cssString(value) {
    return `"${String(value).replace(/["\\\n]/g, '')}"`;
}

/** Writes the stylesheet for the current customization. */
function applyCustom() {
    const { tokens, flags, css } = custom();
    const body = document.body.classList;
    const lines = [];
    const vars = { ...Object.fromEntries(Object.entries(tokens).filter(([key, value]) => /^--[a-zA-Z0-9-]+$/.test(key) && safe(value))) };
    if (flags.avatarShape && AVATAR_RADIUS[flags.avatarShape]) {
        vars['--dsc-avatar-radius'] = AVATAR_RADIUS[flags.avatarShape];
    }
    Object.assign(vars, DENSITY[flags.density] ?? {});
    if (vars['--dsc-blurple']) {
        // the accent's pressed and hover shades follow it
        vars['--dsc-blurple-hover'] = `color-mix(in srgb, ${safe(vars['--dsc-blurple'])} 82%, black)`;
        vars['--dsc-blurple-active'] = `color-mix(in srgb, ${safe(vars['--dsc-blurple'])} 70%, black)`;
        vars['--interactable-outline-color'] = vars['--dsc-blurple'];
    }
    if (vars['--dsc-font']) {
        // the chosen font first, Discord's stack after it
        vars['--dsc-font'] = `${cssString(vars['--dsc-font'])}, "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif`;
        vars['--dsc-font-display'] = vars['--dsc-font'];
    }
    // background
    body.toggle('dsc-chat-gradient', flags.bgMode === 'gradient');
    body.toggle('dsc-chat-picture', flags.bgMode === 'image' && !!flags.bgImage);
    if (flags.bgMode === 'color' && flags.bgColor) {
        vars['--dsc-chat'] = safe(flags.bgColor);
    }
    if (flags.bgMode === 'gradient') {
        vars['--dsc-chat-gradient'] = `linear-gradient(${Number(flags.bgAngle ?? 160)}deg, ${safe(flags.bgFrom || '#5865f2')}, ${safe(flags.bgTo || '#eb459f')})`;
    }
    if (flags.bgMode === 'image' && flags.bgImage) {
        const url = String(flags.bgImage).trim();
        if (/^(https?:\/\/|\/)/.test(url)) {
            vars['--dsc-chat-picture'] = `url(${cssString(url)})`;
        }
        vars['--dsc-chat-picture-blur'] = `${Number(flags.bgBlur ?? 0)}px`;
        vars['--dsc-chat-picture-dim'] = String(Number(flags.bgDim ?? 0.4));
    }
    lines.push(`body.discord-theme {\n${Object.entries(vars).map(([key, value]) => `    ${key}: ${safe(value) || value} !important;`).join('\n')}\n}`);
    // hidden parts
    const hidden = Object.keys(HIDE_SELECTORS).filter(key => flags[HIDE + key] === true).map(key => HIDE_SELECTORS[key]);
    if (hidden.length) {
        lines.push(`${hidden.map(selector => selector.split(',').map(part => `body.discord-theme ${part.trim()}`).join(', ')).join(',\n')} {\n    display: none !important;\n    content: none !important;\n}`);
    }
    // names
    for (const [name, color] of Object.entries(nameColors(flags))) {
        if (safe(color)) {
            lines.push(`body.discord-theme #chat .mes[ch_name=${cssString(name)}] .name_text { color: ${safe(color)} !important; }`);
        }
    }
    // motion
    body.toggle('dsc-motion-off', flags.motion === 'off');
    body.toggle('dsc-motion-reduced', flags.motion === 'reduced');
    // custom CSS, nested under the theme's class so it only applies while the theme is on
    if (css && String(css).trim()) {
        lines.push(`body.discord-theme {\n${String(css).replace(/<\/?style[^>]*>/gi, '')}\n}`);
    }
    let style = document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        document.head.append(style);
    }
    style.textContent = lines.join('\n\n');
}

function changed() {
    applyCustom();
    save();
    renderPreview();
}

/* ---------- export and import ---------- */

function exportCustom() {
    const { tokens, flags, css } = structuredClone(custom());
    const data = { themeId: THEME_ID, version: VERSION, tokens, flags, css };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'discord-theme.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** Reads an exported customization, keeping only what this theme understands. */
function importCustom(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        toastr.error(t('That isn\'t a theme file.'));
        return false;
    }
    if (!data || typeof data !== 'object' || typeof data.tokens !== 'object' || !data.themeId) {
        toastr.error(t('That isn\'t a theme file.'));
        return false;
    }
    if (data.themeId !== THEME_ID) {
        toastr.info(t('This file was made for another theme; matching settings were brought over.'));
    }
    const next = empty();
    for (const [key, value] of Object.entries(data.tokens ?? {})) {
        if (/^--[a-zA-Z0-9-]+$/.test(key) && typeof value === 'string') {
            next.tokens[key] = value;
        }
    }
    for (const [key, value] of Object.entries(typeof data.flags === 'object' ? data.flags ?? {} : {})) {
        if (value === true || typeof value === 'string') {
            next.flags[key] = value;
        }
    }
    next.css = typeof data.css === 'string' ? data.css : '';
    getSettings().customize = next;
    changed();
    renderPage();
    toastr.success(t('Theme imported'));
    return true;
}

async function promptImport() {
    const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();
    const pick = document.createElement('input');
    pick.type = 'file';
    pick.accept = 'application/json,.json';
    pick.addEventListener('change', async () => {
        const file = pick.files?.[0];
        if (file) {
            importCustom(await file.text());
        }
    }, { once: true });
    const choice = await callGenericPopup(t('Import a theme file, or paste its contents below.'), POPUP_TYPE.INPUT, '', {
        okButton: t('Import'),
        customButtons: [{ text: t('Choose File…'), result: null, action: () => pick.click() }],
        rows: 6,
    });
    if (typeof choice === 'string' && choice.trim()) {
        importCustom(choice);
    }
}

/* ---------- the page ---------- */

function valueOf(field) {
    const { tokens, flags } = custom();
    if (field.token) {
        return tokens[field.token];
    }
    if (field.hide) {
        return flags[HIDE + field.hide] !== true;
    }
    if (field.flag === 'css') {
        return custom().css;
    }
    return flags[field.flag];
}

function setValue(field, value) {
    const c = custom();
    if (field.token) {
        if (value === '' || value === null || value === undefined) {
            delete c.tokens[field.token];
        } else {
            c.tokens[field.token] = String(value);
        }
    } else if (field.hide) {
        if (value) {
            delete c.flags[HIDE + field.hide];
        } else {
            c.flags[HIDE + field.hide] = true;
        }
    } else if (field.flag === 'css') {
        c.css = String(value ?? '');
    } else if (value === '' || value === null || value === undefined) {
        delete c.flags[field.flag];
    } else {
        c.flags[field.flag] = String(value);
    }
    changed();
}

/** The theme's current value of a variable, for a colour field's starting point. */
function currentColor(token) {
    return getComputedStyle(document.body).getPropertyValue(token).trim();
}

function toHex(color) {
    const probe = document.createElement('span');
    probe.style.color = color;
    document.body.append(probe);
    const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
    probe.remove();
    return `#${rgb.slice(0, 3).map(x => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
}

function fieldRow(field) {
    const row = document.createElement('div');
    row.className = `dsc-cz-row dsc-cz-t-${field.type}`;
    const label = document.createElement('label');
    label.className = 'dsc-cz-label';
    label.textContent = t(field.label);
    row.append(label);
    const value = valueOf(field);
    const id = `dsc-cz-${(field.token || field.flag || field.hide).replace(/[^a-z0-9]/gi, '')}`;
    label.htmlFor = id;

    if (field.type === 'color') {
        const wrap = document.createElement('span');
        wrap.className = 'dsc-cz-color';
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.setAttribute('aria-label', `${t(field.label)}: ${t('pick a color')}`);
        const text = document.createElement('input');
        text.type = 'text';
        text.id = id;
        text.className = 'text_pole';
        text.placeholder = field.token ? currentColor(field.token) || t('Theme default') : field.base ?? t('Choose a colour');
        text.value = value ?? '';
        picker.value = toHex(value || (field.token ? currentColor(field.token) : field.base) || '#5865f2');
        picker.addEventListener('input', () => {
            text.value = picker.value;
            setValue(field, picker.value);
        });
        text.addEventListener('change', () => {
            setValue(field, text.value.trim());
            if (text.value.trim()) {
                picker.value = toHex(text.value.trim());
            }
        });
        wrap.append(picker, text);
        row.append(wrap);
    } else if (field.type === 'range') {
        const wrap = document.createElement('span');
        wrap.className = 'dsc-cz-range';
        const input = document.createElement('input');
        input.type = 'range';
        input.id = id;
        input.min = String(field.min);
        input.max = String(field.max);
        input.step = String(field.step);
        const start = value !== undefined ? parseFloat(value) : field.base;
        input.value = String(start);
        const shown = document.createElement('span');
        shown.textContent = `${start}${field.unit}`;
        input.addEventListener('input', () => {
            shown.textContent = `${input.value}${field.unit}`;
            setValue(field, field.token ? `${input.value}${field.unit}` : Number(input.value));
        });
        wrap.append(input, shown);
        row.append(wrap);
    } else if (field.type === 'select') {
        const select = document.createElement('select');
        select.id = id;
        select.className = 'text_pole';
        for (const [optionValue, optionLabel] of field.options) {
            select.append(new Option(t(optionLabel), optionValue));
        }
        select.value = value ?? field.base;
        select.addEventListener('change', () => {
            setValue(field, select.value === field.base ? '' : select.value);
            if (field.flag === 'bgMode') {
                renderPage();
            }
        });
        row.append(select);
    } else if (field.type === 'text' || field.type === 'font') {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.className = 'text_pole';
        input.placeholder = t(field.placeholder ?? (field.type === 'font' ? 'gg sans (Discord)' : ''));
        input.value = value ?? '';
        if (field.type === 'font') {
            const list = document.createElement('datalist');
            list.id = `${id}-list`;
            for (const name of ['system-ui', 'Inter', 'Segoe UI', 'SF Pro Text', 'Helvetica Neue', 'Arial', 'Roboto', 'Noto Sans', 'Open Sans', 'Georgia', 'Menlo', 'Comic Sans MS']) {
                list.append(new Option(name, name));
            }
            input.setAttribute('list', list.id);
            row.append(list);
        }
        input.addEventListener('change', () => setValue(field, input.value.trim()));
        row.append(input);
    } else if (field.type === 'show') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = value !== false;
        input.addEventListener('input', () => setValue(field, input.checked));
        row.append(input);
    } else if (field.type === 'css') {
        const area = document.createElement('textarea');
        area.id = id;
        area.className = 'text_pole dsc-cz-css';
        area.rows = 8;
        area.spellcheck = false;
        area.placeholder = '.dsc-dm { letter-spacing: 0.02em; }';
        area.value = value ?? '';
        let timer = 0;
        area.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => setValue(field, area.value), 300);
        });
        row.append(area);
    } else if (field.type === 'names') {
        row.append(nameColorsEditor());
    }
    if (field.note) {
        const note = document.createElement('small');
        note.className = 'dsc-cz-note';
        note.textContent = t(field.note);
        row.append(note);
    }
    return row;
}

/** Name colours for the characters you talk to. */
function nameColorsEditor() {
    const { characters } = SillyTavern.getContext();
    const holder = document.createElement('div');
    holder.className = 'dsc-cz-namelist';
    const names = [...new Set(characters.map(x => x.name))].slice(0, 60);
    for (const name of names) {
        const row = document.createElement('label');
        row.className = 'dsc-cz-name';
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.setAttribute('aria-label', `${name}: ${t('name color')}`);
        const current = custom().flags[NAME + name];
        picker.value = current ? toHex(current) : '#f2f3f5';
        const text = document.createElement('span');
        text.textContent = name;
        if (current) {
            text.style.color = current;
        }
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'dsc-cz-clear';
        clear.textContent = '×';
        clear.title = t('Reset');
        clear.hidden = !current;
        picker.addEventListener('input', () => {
            custom().flags[NAME + name] = picker.value;
            text.style.color = picker.value;
            clear.hidden = false;
            changed();
        });
        clear.addEventListener('click', (event) => {
            event.preventDefault();
            delete custom().flags[NAME + name];
            text.style.color = '';
            clear.hidden = true;
            changed();
        });
        row.append(picker, text, clear);
        holder.append(row);
    }
    return holder;
}

function resetSection(section) {
    const c = custom();
    for (const field of section.fields) {
        if (field.token) {
            delete c.tokens[field.token];
        } else if (field.hide) {
            delete c.flags[HIDE + field.hide];
        } else if (field.flag === 'nameColors') {
            for (const key of Object.keys(c.flags).filter(x => x.startsWith(NAME))) {
                delete c.flags[key];
            }
        } else if (field.flag === 'css') {
            c.css = '';
        } else if (field.flag) {
            delete c.flags[field.flag];
        }
    }
    changed();
    renderPage();
}

/** The preview strip: a sidebar row, a message group and the message box in the current look. */
function previewStrip() {
    const preview = document.createElement('div');
    preview.className = 'dsc-cz-preview';
    preview.setAttribute('aria-hidden', 'true');
    const name = SillyTavern.getContext().name2 || 'Lyra';
    preview.innerHTML = `
        <div class="dsc-cz-pv-rail"><span class="dsc-cz-pv-server"></span><span class="dsc-cz-pv-server dsc-cz-pv-alt"></span></div>
        <div class="dsc-cz-pv-side"><div class="dsc-cz-pv-row dsc-cz-pv-sel"><span class="dsc-cz-pv-av"></span><span>${escapeHtml(name)}</span></div><div class="dsc-cz-pv-row"><span class="dsc-cz-pv-av dsc-cz-pv-alt"></span><span>${escapeHtml(t('Friends'))}</span></div></div>
        <div class="dsc-cz-pv-chat">
            <div class="dsc-cz-pv-mes"><span class="dsc-cz-pv-av dsc-cz-pv-big"></span><div><div><b class="dsc-cz-pv-name">${escapeHtml(name)}</b> <small>${escapeHtml(t('Today at'))} 4:20 PM</small></div><div class="dsc-cz-pv-text">${escapeHtml(t('Hey! This is how your messages will look.'))} <a>${escapeHtml(t('A link'))}</a></div></div></div>
            <div class="dsc-cz-pv-box">${escapeHtml(t('Message'))} @${escapeHtml(name)}</div>
        </div>`;
    return preview;
}

function renderPreview() {
    // the preview reads the same variables as the page, so it follows on its own; this keeps
    // the name colour for the shown character in step
    const shown = document.querySelector(`#${PAGE_ID} .dsc-cz-pv-name`);
    if (shown) {
        const name = shown.textContent;
        shown.style.color = custom().flags[NAME + name] ?? '';
    }
}

function renderPage() {
    const page = document.getElementById(PAGE_ID);
    if (!page) {
        return;
    }
    const flags = custom().flags;
    const parts = [previewStrip()];
    const tools = document.createElement('div');
    tools.className = 'dsc-cz-tools';
    const button = (label, run, primary = false) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = `menu_button${primary ? ' dsc-primary' : ''}`;
        element.textContent = t(label);
        element.addEventListener('click', run);
        return element;
    };
    const dock = button(document.body.classList.contains('dsc-cz-docked') ? 'Back to Settings' : 'Preview in Chat', () => {
        const docked = document.body.classList.toggle('dsc-cz-docked');
        dock.textContent = t(docked ? 'Back to Settings' : 'Preview in Chat');
    }, true);
    dock.classList.add('dsc-cz-dock');
    tools.append(
        dock,
        button('Export Theme', exportCustom),
        button('Import Theme', promptImport),
        button('Reset All', async () => {
            const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();
            if (await callGenericPopup(t('Reset every customization to the theme\'s own look?'), POPUP_TYPE.CONFIRM)) {
                getSettings().customize = empty();
                changed();
                renderPage();
            }
        }),
    );
    parts.push(tools);
    for (const section of SECTIONS) {
        const block = document.createElement('section');
        block.className = 'dsc-cz-section';
        const head = document.createElement('div');
        head.className = 'dsc-cz-head';
        const title = document.createElement('h4');
        title.textContent = t(section.title);
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'dsc-cz-reset';
        reset.textContent = t('Reset section');
        reset.addEventListener('click', () => resetSection(section));
        head.append(title, reset);
        block.append(head);
        if (section.note) {
            const note = document.createElement('p');
            note.className = 'dsc-cz-note';
            note.textContent = t(section.note);
            block.append(note);
        }
        for (const field of section.fields) {
            if (field.when && (flags[field.when[0]] ?? 'none') !== field.when[1]) {
                continue;
            }
            block.append(fieldRow(field));
        }
        parts.push(block);
    }
    page.replaceChildren(...parts);
    renderPreview();
}

/** The page element, placed where a settings section shows. */
/** Leaves the docked preview, when the page closes. */
/** A customized variable's value, '' if it has none. */
export function getToken(token) {
    return custom().tokens[token] ?? '';
}

/** Sets a variable from outside the page (the sidebar handles); '' puts the theme's own back.
 * `keep` false only shows it, for a drag in progress. */
export function setToken(token, value, keep = true) {
    const c = custom();
    if (value) {
        c.tokens[token] = String(value);
    } else {
        delete c.tokens[token];
    }
    applyCustom();
    if (keep) {
        save();
        if (document.getElementById(PAGE_ID)?.isConnected) {
            renderPage();
        }
    }
}

export function undock() {
    document.body.classList.remove('dsc-cz-docked');
}

export function ensurePage() {
    let page = document.getElementById(PAGE_ID);
    if (!page) {
        page = document.createElement('div');
        page.id = PAGE_ID;
        document.body.append(page);
    }
    renderPage();
    return page;
}

/**
 * @param {object} options
 * @param {() => object} options.settings
 * @param {() => void} options.save
 */
export function initCustomize(options) {
    getSettings = options.settings;
    save = options.save;
    applyCustom();
}
