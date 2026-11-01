// Discord exists in SillyTavern's page only while it's on.
// - Off at load: nothing is built (only its own settings panel in the Extensions list).
// - Built: handlers on anything that outlives the theme (SillyTavern events, document, window,
//   SillyTavern's elements, MutationObservers) go through listen/onEvent/GatedObserver, so they
//   do nothing while the theme is off. Handlers on the theme's own elements need no gate: those
//   elements are removed with it.
// - Turned off live: teardown() removes everything the theme added to SillyTavern's page
//   (its elements, classes, attributes, styles) and redraws the open chat with SillyTavern's
//   own formatting.

let isOn = () => false;

/** Sets the check every gated handler runs first. */
export function setGate(check) {
    isOn = check;
}

/** Wraps a handler so it does nothing while the theme is off. */
export function gated(handler) {
    return function (...args) {
        return isOn() ? handler.apply(this, args) : undefined;
    };
}

/** addEventListener for targets that outlive the theme (document, window, SillyTavern's elements). */
export function listen(target, type, handler, options) {
    target?.addEventListener(type, gated(handler), options);
}

/** eventSource.on, gated. */
export function onEvent(type, handler) {
    SillyTavern.getContext().eventSource.on(type, gated(handler));
}

/** A MutationObserver whose callback does nothing while the theme is off. */
export class GatedObserver extends MutationObserver {
    constructor(callback) {
        super(gated(callback));
    }
}

/** Elements the theme makes inside SillyTavern's own blocks, which carry only a class. */
const MADE = '.dsc-samplers-toggle, .dsc-instruct-switch, .dsc-react-button, .dsc-file-download, .dsc-tool-search-phone, .dsc-edited, .dsc-embeds, .dsc-reactions, .dsc-deco, .dsc-plate, .dsc-effect, .dsc-frame';

/** Whether an element belongs to the theme's own settings panel (in the Extensions list). */
function inPanel(element) {
    return !!element.closest('.dsc-settings-panel');
}

/** Removes everything the theme added to SillyTavern's page. */
export function teardown() {
    // the theme's own elements: by id, and the class-only ones it puts in SillyTavern's blocks
    for (const element of [...document.querySelectorAll('[id^="dsc-"], [id^="dsc_"]'), ...document.querySelectorAll(MADE)]) {
        if (element.isConnected && !inPanel(element)) {
            element.remove();
        }
    }
    // its classes, attributes and variables on SillyTavern's own elements
    for (const element of document.querySelectorAll('[class*="dsc-"], [style*="--dsc-"]')) {
        if (inPanel(element)) {
            continue;
        }
        const ours = [...element.classList].filter(name => name.startsWith('dsc-'));
        if (ours.length) {
            element.classList.remove(...ours);
        }
        for (const property of [...element.style].filter(name => name.startsWith('--dsc-'))) {
            element.style.removeProperty(property);
        }
    }
    for (const element of document.querySelectorAll('*')) {
        if (inPanel(element)) {
            continue;
        }
        for (const attribute of [...element.attributes].filter(a => a.name.startsWith('data-dsc'))) {
            element.removeAttribute(attribute.name);
        }
    }
    for (const html of [document.documentElement, document.body]) {
        html.classList.remove(...[...html.classList].filter(name => name.startsWith('dsc-')));
    }
    // messages: SillyTavern draws the open chat again with its own formatting
    const context = SillyTavern.getContext();
    if (context.getCurrentChatId?.()) {
        context.reloadCurrentChat?.();
    }
}
