// The character and group editors as Discord's full-screen settings: a character opens like
// your Profile page, a group like Server Settings, with a sidebar of their sections and the
// round close button. The editors themselves are SillyTavern's, placed in the page's spot;
// the sidebar's items scroll to their parts or press SillyTavern's own buttons.

import { selectServer } from './sidebar.js';
import { closeDrawers, icon, shieldFromOutsideClose, t } from './ui.js';
import { GatedObserver, listen, onEvent } from './life.js';

const ID = 'dsc-editor';

/** Which editor the character panel shows: '' (the list), 'char' or 'group' */
let mode = '';

function visible(id) {
    const element = document.getElementById(id);
    return !!element && element.style.display !== 'none' && getComputedStyle(element).display !== 'none';
}

function press(id) {
    document.getElementById(id)?.click();
}

/** Brings a part of a page to the top of its scroller and lights it up for a moment. */
function showPart(element, lit = [element]) {
    element?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    for (const part of lit) {
        part?.classList.remove('dsc-flash');
        // restarts the animation when it's pressed again
        void part?.getBoundingClientRect();
        part?.classList.add('dsc-flash');
        setTimeout(() => part?.classList.remove('dsc-flash'), 1300);
    }
}

function scrollTo(id) {
    showDefinitions(false);
    const target = document.getElementById(id);
    if (target) {
        showPart(target);
    } else {
        document.getElementById('right-nav-panel')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function definitionsOpen() {
    return visible('character_popup');
}

/** The Definitions form takes the Profile form's place in the page, rather than popping up over it. */
function showDefinitions(show) {
    document.body.classList.toggle('dsc-editor-defs', show);
    if (show !== definitionsOpen()) {
        press(show ? 'advanced_div' : 'character_cross');
    }
    const title = document.querySelector(`#${ID} .dsc-set-title`);
    if (title && mode === 'char') {
        title.textContent = t(show ? 'Definitions' : 'Profile');
    }
    if (show) {
        document.getElementById('character_popup')?.scrollTo({ top: 0 });
    }
}

/** The character's Scenario: SillyTavern keeps it with the Definitions. */
function openScenario() {
    showDefinitions(true);
    const field = document.getElementById('scenario_pole');
    showPart(field?.previousElementSibling, [field?.previousElementSibling, field]);
    field?.focus({ preventScroll: true });
}

function currentName() {
    const context = SillyTavern.getContext();
    if (mode === 'group') {
        // creating: the new server has no name yet (the open one isn't it)
        if (visible('rm_group_submit')) {
            return /** @type {HTMLInputElement} */ (document.getElementById('rm_group_chat_name'))?.value || '';
        }
        const group = context.groupId ? context.groups.find(x => String(x.id) === String(context.groupId)) : null;
        return group?.name ?? '';
    }
    const name = /** @type {HTMLInputElement} */ (document.getElementById('character_name_pole'))?.value;
    return name || '';
}

function sections() {
    if (mode === 'group') {
        const editing = visible('rm_group_delete');
        return [
            { heading: currentName() || t('New Server') },
            { label: 'Overview', run: () => scrollTo('') },
            { label: 'Members', run: () => scrollTo('rm_group_members') },
            { label: 'Add Members', run: () => scrollTo('rm_group_add_members') },
            // SillyTavern sets a server's scenario only once it exists
            visible('rm_group_scenario')
                ? { label: 'Scenario', run: () => press('rm_group_scenario') }
                : { label: 'Scenario', muted: true, run: () => toastr.info(t('Create the server first; its scenario is set here afterwards.')) },
            ...(editing ? ['separator', { label: 'Delete Server', danger: true, run: () => press('rm_group_delete') }] : []),
        ];
    }
    const editing = visible('delete_button');
    return [
        { heading: currentName() || t('New Character') },
        { label: 'Profile', run: () => scrollTo('') },
        { label: 'Definitions', run: () => showDefinitions(true) },
        { label: 'Scenario', run: openScenario },
        ...(editing ? [
            { label: 'Lorebook', run: () => press('world_button') },
            { label: 'Export', run: () => press('export_button') },
            { label: 'Duplicate', run: () => press('dupe_button') },
            'separator',
            { label: 'Delete Character', danger: true, run: () => press('delete_button') },
        ] : []),
    ];
}

function build() {
    let root = document.getElementById(ID);
    if (root) {
        return root;
    }
    root = document.createElement('div');
    root.id = ID;
    root.setAttribute('role', 'dialog');
    const side = document.createElement('div');
    side.className = 'dsc-set-side';
    const nav = document.createElement('nav');
    nav.className = 'dsc-set-nav';
    side.append(nav);
    const main = document.createElement('div');
    main.className = 'dsc-set-main';
    const title = document.createElement('h2');
    title.className = 'dsc-set-title';
    main.append(title);
    const close = document.createElement('div');
    close.className = 'dsc-set-close';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', t('Close'));
    closeButton.append(icon('close', 18));
    closeButton.addEventListener('click', () => closeDrawers());
    const esc = document.createElement('span');
    esc.textContent = 'ESC';
    esc.setAttribute('aria-hidden', 'true');
    close.append(closeButton, esc);
    // Discord's save bar along the bottom: Create while creating, a note while editing
    const foot = document.createElement('div');
    foot.className = 'dsc-editor-foot';
    root.append(side, main, close, foot);
    document.body.append(root);
    shieldFromOutsideClose(root);
    return root;
}

function render() {
    const root = build();
    const nav = root.querySelector('.dsc-set-nav');
    let first = true;
    nav.replaceChildren(...sections().map((section) => {
        if (section === 'separator') {
            const sep = document.createElement('div');
            sep.className = 'dsc-set-sep';
            return sep;
        }
        if (section.heading) {
            const heading = document.createElement('h2');
            heading.className = 'dsc-set-heading';
            heading.textContent = section.heading;
            return heading;
        }
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'dsc-set-item';
        item.classList.toggle('dsc-set-danger', !!section.danger);
        item.classList.toggle('dsc-set-muted', !!section.muted);
        if (section.muted) {
            item.title = t('Create the server first; its scenario is set here afterwards.');
        }
        item.classList.toggle('dsc-selected', first);
        first = false;
        item.textContent = t(section.label);
        item.addEventListener('click', () => {
            if (!section.danger && !section.muted && !['Lorebook', 'Export', 'Duplicate'].includes(section.label)) {
                nav.querySelectorAll('.dsc-set-item').forEach(x => x.classList.toggle('dsc-selected', x === item));
            }
            section.run();
        });
        return item;
    }));
    root.querySelector('.dsc-set-title').textContent = t(mode === 'group' ? 'Server Overview' : 'Profile');
}

/** Creates the server (group) or character with SillyTavern's own button, then opens the new
    server's chat, which SillyTavern doesn't do by itself. */
async function create() {
    const context = SillyTavern.getContext();
    if (mode === 'group') {
        if (!document.querySelector('#rm_group_members .group_member')) {
            toastr.warning(t('Add at least one member first.'));
            return;
        }
        const before = new Set(context.groups.map(group => String(group.id)));
        press('rm_group_submit');
        for (let i = 0; i < 50; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            const made = SillyTavern.getContext().groups.find(group => !before.has(String(group.id)));
            if (made) {
                // the theme's own way in: leaves Friends and opens the server's channel
                await selectServer(String(made.id), true);
                return;
            }
        }
        return;
    }
    press('create_button');
}

/** The save bar: what it says and offers follows the page. */
function renderFoot() {
    const foot = document.querySelector(`#${ID} .dsc-editor-foot`);
    if (!foot) {
        return;
    }
    const creating = mode === 'group' ? visible('rm_group_submit') : !visible('delete_button');
    const key = `${mode}:${creating}`;
    if (foot.dataset.key === key) {
        return;
    }
    // the sections differ between creating and editing (Scenario, Delete)
    if (foot.dataset.key) {
        render();
    }
    foot.dataset.key = key;
    const note = document.createElement('span');
    note.className = 'dsc-editor-note';
    if (creating) {
        note.textContent = t(mode === 'group' ? 'Name your server and add members, then create it.' : 'Give your character a name, then create it.');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu_button dsc-primary dsc-editor-create';
        button.textContent = t(mode === 'group' ? 'Create Server' : 'Create Character');
        button.addEventListener('click', create);
        foot.replaceChildren(note, button);
    } else {
        note.textContent = t('Changes save automatically.');
        foot.replaceChildren(note);
    }
}

/** Follows the character panel: which block shows, and whether it's open. */
function update() {
    const open = document.body.classList.contains('dsc-chars-open');
    const next = !open ? '' : visible('rm_group_chats_block') ? 'group' : visible('rm_ch_create_block') ? 'char' : '';
    const body = document.body.classList;
    // leaving the page, or going to another of its kind, starts on its first form again
    if (next !== 'char' && body.contains('dsc-editor-defs')) {
        showDefinitions(false);
    }
    body.toggle('dsc-editor-open', !!next);
    body.toggle('dsc-editor-group', next === 'group');
    if (next && (next !== mode || !document.getElementById(ID))) {
        mode = next;
        render();
    } else if (next) {
        // the name heading follows edits and newly opened characters
        const heading = document.querySelector(`#${ID} .dsc-set-heading`);
        if (heading) {
            heading.textContent = currentName() || t(mode === 'group' ? 'New Server' : 'New Character');
        }
    }
    mode = next;
    if (next) {
        renderFoot();
    }
}

export function initEditor() {
    // Enter in a new server's name creates it
    listen(document, 'keydown', (event) => {
        const target = /** @type {HTMLElement} */ (event.target);
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && target?.id === 'rm_group_chat_name' && visible('rm_group_submit')) {
            event.preventDefault();
            create();
        }
    }, true);
    shieldFromOutsideClose(document.getElementById('character_popup'));
    const observer = new GatedObserver(() => requestAnimationFrame(update));
    for (const id of ['rm_ch_create_block', 'rm_group_chats_block', 'rm_characters_block']) {
        const element = document.getElementById(id);
        if (element) {
            observer.observe(element, { attributes: true, attributeFilter: ['style'] });
        }
    }
    const { eventTypes } = SillyTavern.getContext();
    onEvent(eventTypes.CHAT_CHANGED, () => requestAnimationFrame(update));
    onEvent(eventTypes.CHARACTER_EDITED, () => requestAnimationFrame(update));
    onEvent(eventTypes.GROUP_UPDATED, () => requestAnimationFrame(update));
    listen(document, 'keydown', (event) => {
        if (event.key !== 'Escape' || !document.body.classList.contains('dsc-editor-open')) {
            return;
        }
        const menu = document.getElementById('dsc-menu');
        if (document.querySelector('dialog.popup[open]') || (menu && !menu.hidden)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        closeDrawers();
    }, true);
    update();
}

/** Called when the panel opens or closes (index.js tracks the drawers). */
export const refreshEditor = () => update();
