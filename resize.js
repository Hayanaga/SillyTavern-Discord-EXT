// Drag handles on the inner edges of both sidebars (the conversation list on the left, the
// profile, member list or search results on the right) to change their widths, as in Discord.
// Widths go into the Customize page's own settings, so its sliders follow, and stay.

import { getToken, setToken } from './customize.js';

const LIMITS = {
    '--dsc-side-w': [200, 480, 240],
    '--dsc-profile-w': [260, 600, 340],
    '--dsc-members-w': [200, 480, 264],
    '--dsc-search-w': [300, 720, 420],
};

/** The variable the right-hand panel's width comes from right now. */
function asideToken() {
    const body = document.body.classList;
    if (body.contains('dsc-search-open')) {
        return '--dsc-search-w';
    }
    return body.contains('dsc-channel') ? '--dsc-members-w' : '--dsc-profile-w';
}

function handle(id, label, token, widthAt) {
    const grip = document.createElement('div');
    grip.id = id;
    grip.className = 'dsc-resize';
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'vertical');
    grip.setAttribute('aria-label', label);
    grip.title = label;
    grip.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        grip.setPointerCapture(event.pointerId);
        const name = token();
        const [min, max] = LIMITS[name];
        document.body.classList.add('dsc-resizing');
        let frame = 0;
        const move = (e) => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                setToken(name, `${Math.round(Math.min(max, Math.max(min, widthAt(e.clientX))))}px`, false);
            });
        };
        const done = () => {
            cancelAnimationFrame(frame);
            grip.removeEventListener('pointermove', move);
            document.body.classList.remove('dsc-resizing');
            setToken(name, getToken(name), true);
        };
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', done, { once: true });
        grip.addEventListener('pointercancel', done, { once: true });
    });
    // a double click puts the width back to the theme's own
    grip.addEventListener('dblclick', () => setToken(token(), '', true));
    return grip;
}

export function initResize() {
    const rail = () => document.getElementById('dsc-side')?.getBoundingClientRect().left ?? 76;
    document.body.append(
        handle('dsc-resize-side', 'Resize the sidebar', () => '--dsc-side-w', x => x - rail()),
        handle('dsc-resize-aside', 'Resize the side panel', asideToken, x => window.innerWidth - x),
    );
}
