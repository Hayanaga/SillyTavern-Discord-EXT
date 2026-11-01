// Discord's theme picker at the top of the Appearance page: round swatches for Light, Ash,
// Dark, Onyx and Sync, then the Nitro "Color" themes as gradient swatches.

import { APP_ICONS, appIconSource, currentAppIcon, pickAppIcon } from './appicons.js';
import { gradientOf, NITRO_THEMES } from './nitro.js';
import { icon, t } from './ui.js';

const ID = 'dsc-appearance';

const BASES = [
    { id: 'light', name: 'Light', swatch: '#fbfbfb' },
    { id: 'ash', name: 'Ash', swatch: '#323339' },
    { id: 'dark', name: 'Dark', swatch: '#1a1a1e' },
    { id: 'onyx', name: 'Onyx', swatch: '#000000' },
    { id: 'system', name: 'Sync with computer', swatch: 'linear-gradient(135deg, #fbfbfb 50%, #1a1a1e 50%)' },
];

let actions = {
    current: () => ({ appearance: 'dark', nitroTheme: '' }),
    setBase: (_id) => {},
    setNitro: (_id) => {},
    /** reads and writes the message display options */
    get: (_key) => undefined,
    set: (_key, _value) => {},
};

/** A radio card, as Discord's Message Display choices */
function radioCard(name, value, label, note, checked, onPick) {
    const card = document.createElement('label');
    card.className = 'dsc-radio-card';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = checked;
    input.addEventListener('change', () => onPick(value));
    const text = document.createElement('span');
    text.className = 'dsc-radio-text';
    const strong = document.createElement('strong');
    strong.textContent = t(label);
    const small = document.createElement('small');
    small.textContent = t(note);
    text.append(strong, small);
    card.append(input, text);
    return card;
}

/** A slider with its value shown, as Discord's font size and spacing sliders */
function slider(id, label, min, max, step, value, unit, onChange) {
    const row = document.createElement('div');
    row.className = 'dsc-ap-slider';
    const head = document.createElement('div');
    head.className = 'dsc-ap-slider-head';
    const name = document.createElement('label');
    name.htmlFor = id;
    name.textContent = t(label);
    const shown = document.createElement('span');
    shown.textContent = `${value}${unit}`;
    head.append(name, shown);
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
        shown.textContent = `${input.value}${unit}`;
        onChange(Number(input.value));
    });
    row.append(head, input);
    return row;
}

function toggleRow(id, label, note, checked, onChange) {
    const row = document.createElement('label');
    row.className = 'checkbox_label dsc-ap-toggle';
    row.htmlFor = id;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = checked;
    input.addEventListener('input', () => onChange(input.checked));
    const text = document.createElement('span');
    text.textContent = t(label);
    if (note) {
        const small = document.createElement('small');
        small.textContent = t(note);
        text.append(small);
    }
    row.append(input, text);
    return row;
}

/** Message display, chat font size, group spacing and the clock. */
function renderDisplay(root) {
    const host = root.querySelector('.dsc-ap-display');
    const display = actions.get('messageDisplay') ?? 'cozy';
    const pick = value => actions.set('messageDisplay', value);
    host.replaceChildren(
        radioCard('dsc-display', 'cozy', 'Cozy', 'Modern, beautiful, and easy on your eyes.', display === 'cozy', pick),
        radioCard('dsc-display', 'compact', 'Compact', 'Fit more messages on screen at one time. #IRC', display === 'compact', pick),
        slider('dsc_font', 'Chat Font Scaling', 12, 24, 1, actions.get('chatFont') ?? 16, 'px', value => actions.set('chatFont', value)),
        slider('dsc_group_gap', 'Space Between Message Groups', 0, 24, 2, actions.get('groupGap') ?? 16, 'px', value => actions.set('groupGap', value)),
        toggleRow('dsc_24h', 'Use 24-hour time', 'Times read 16:20 instead of 4:20 PM.', !!actions.get('clock24'), value => actions.set('clock24', value)),
    );
}

function swatch(className, label, background, selected, run) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `dsc-swatch ${className}`;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(selected));
    button.dataset.dscTip = label;
    button.style.background = background;
    button.classList.toggle('dsc-selected', selected);
    if (selected) {
        const check = document.createElement('span');
        check.className = 'dsc-swatch-check';
        check.append(icon('check', 12));
        button.append(check);
    }
    button.addEventListener('click', run);
    return button;
}

/** Draws the picker for the current choice. */
export function renderAppearance() {
    const root = document.getElementById(ID);
    if (!root) {
        return;
    }
    const { appearance, nitroTheme } = actions.current();
    const themeRow = root.querySelector('.dsc-swatches-base');
    const colorRow = root.querySelector('.dsc-swatches-color');
    const iconRow = root.querySelector('.dsc-swatches-icon');
    themeRow.replaceChildren(...BASES.map(base => swatch('', t(base.name), base.swatch, !nitroTheme && appearance === base.id, () => actions.setBase(base.id))));
    colorRow.replaceChildren(...NITRO_THEMES.map(theme => swatch('dsc-swatch-gradient', t(theme.name), gradientOf(theme), nitroTheme === theme.id, () => actions.setNitro(theme.id))));
    const pickIcon = id => pickAppIcon(id).finally(renderAppearance);
    iconRow.replaceChildren(
        swatch('dsc-swatch-icon', t('Default'), 'var(--dsc-blurple)', !currentAppIcon(), () => pickIcon('')),
        ...APP_ICONS.map(item => swatch('dsc-swatch-icon', item.name, `center / cover no-repeat url("${appIconSource(item)}")`, currentAppIcon() === item.id, () => pickIcon(item.id))),
    );
}

function build() {
    const host = document.getElementById('UI-Theme-Block');
    if (!host || document.getElementById(ID)) {
        return;
    }
    const root = document.createElement('section');
    root.id = ID;
    const themeTitle = document.createElement('h4');
    themeTitle.className = 'dsc-ap-title';
    themeTitle.textContent = t('Theme');
    const themeRow = document.createElement('div');
    themeRow.className = 'dsc-swatches dsc-swatches-base';
    const colorTitle = document.createElement('h4');
    colorTitle.className = 'dsc-ap-title';
    colorTitle.append(document.createTextNode(t('Color')), icon('nitro', 16));
    const colorText = document.createElement('p');
    colorText.className = 'dsc-ap-note';
    colorText.textContent = t('Make Discord yours with a color theme.');
    const colorRow = document.createElement('div');
    colorRow.className = 'dsc-swatches dsc-swatches-color';
    const iconTitle = document.createElement('h4');
    iconTitle.className = 'dsc-ap-title';
    iconTitle.append(document.createTextNode(t('App Icon')), icon('nitro', 16));
    const iconRow = document.createElement('div');
    iconRow.className = 'dsc-swatches dsc-swatches-icon';
    const displayTitle = document.createElement('h4');
    displayTitle.className = 'dsc-ap-title';
    displayTitle.textContent = t('Message Display');
    const display = document.createElement('div');
    display.className = 'dsc-ap-display';
    root.append(themeTitle, themeRow, colorTitle, colorText, colorRow, iconTitle, iconRow, displayTitle, display);
    host.prepend(root);
    renderDisplay(root);
}

/**
 * @param {object} options
 * @param {() => {appearance: string, nitroTheme: string}} options.current
 * @param {(id: string) => void} options.setBase
 * @param {(id: string) => void} options.setNitro
 * @param {(key: string) => any} options.get
 * @param {(key: string, value: any) => void} options.set
 */
export function initAppearance(options) {
    actions = { ...actions, ...options };
    build();
    renderAppearance();
}
