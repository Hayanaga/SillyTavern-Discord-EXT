// Renders the repository's social preview (1280×640) to .github/social-preview.png. It first takes its
// own shots on the clean test profile (sample characters only): the same chat in each base theme and
// two Nitro themes on desktop, and the chat with the typing dots on a phone. They go to
// .github/screenshots/raw/preview/ (not committed), and tools/social-preview.html lays them out.
// node tools/social-preview.mjs starts the test server itself and stops it when done.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, BROWSER } from '../test/e2e/env.mjs';
import { SERVER_URL as URL, startTestServer } from './test-server.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, '.github/screenshots/raw/preview');
fs.mkdirSync(OUT, { recursive: true });

const THEMES = [['light', ''], ['ash', ''], ['dark', ''], ['onyx', ''], ['dark', 'aurora'], ['dark', 'chroma-glow']];
const theme = '/scripts/extensions/third-party/SillyTavern-Discord-dev/';

const stopServer = await startTestServer();
const browser = await chromium.launch({ executablePath: BROWSER, headless: true });
const errors = [];

async function open(width, height, mobile = false) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#dsc-side .dsc-dm') && !document.body.classList.contains('dsc-booting') && document.getElementById('dsc_appearance'), null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    return page;
}

const look = (page, base, nitro = '') => page.evaluate(([b, n]) => {
    for (const [id, v] of [['dsc_appearance', b], ['dsc_nitro', n]]) {
        const e = document.getElementById(id);
        e.value = v;
        e.dispatchEvent(new Event('input', { bubbles: true }));
    }
}, [base, nitro]);

const typing = (page, on) => page.evaluate(async ([base, show]) => {
    const presence = await import(`${base}presence.js`);
    if (show) presence.showTyping?.('Seraphina'); else presence.hideTyping?.();
}, [theme, on]);

// ---------- desktop: one chat, every look ----------
const page = await open(1200, 750);
await page.locator('#dsc-side .dsc-dm', { hasText: 'Seraphina' }).first().click();
await page.waitForTimeout(1500);
await page.evaluate(async () => {
    const c = SillyTavern.getContext();
    await c.executeSlashCommandsWithOptions('/newchat');
    await new Promise(r => setTimeout(r, 1200));
    await c.executeSlashCommandsWithOptions('/send Morning! Did you sleep at all?');
    await c.executeSlashCommandsWithOptions('/sendas name="Seraphina" *She stretches and smiles.* Barely, honestly. The owls were loud all night. But the tea helped! Want some? I made a fresh pot.');
    await c.executeSlashCommandsWithOptions('/send Yes please! Tell me about the owls.');
});
await page.waitForTimeout(1500);
await typing(page, true);
for (const [base, nitro] of THEMES) {
    await look(page, base, nitro);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${nitro || base}.png`) });
    console.log('shot', nitro || base);
}
await look(page, 'dark');
await typing(page, false);
await page.close();

// ---------- phone ----------
const phone = await open(390, 844, true);
await look(phone, 'dark');
await phone.locator('#dsc-side .dsc-dm', { hasText: 'Seraphina' }).first().tap();
await phone.waitForTimeout(1800);
await typing(phone, true);
await phone.evaluate(() => { const chat = document.getElementById('chat'); chat.scrollTop = chat.scrollHeight; });
await phone.waitForTimeout(600);
await phone.screenshot({ path: path.join(OUT, 'phone.png') });
console.log('shot phone');
await typing(phone, false);
await phone.close();

console.log('errors', errors.slice(0, 5));
stopServer();

// ---------- the card ----------
const card = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await card.goto(pathToFileURL(path.join(ROOT, 'tools/social-preview.html')).href);
await card.waitForTimeout(800);
await card.screenshot({ path: path.join(ROOT, '.github/social-preview.png') });
await browser.close();
console.log('wrote .github/social-preview.png');
