import { chromium, BROWSER, URL } from './env.mjs';
const browser = await chromium.launch({ executablePath: BROWSER, headless: true });
const errors = [];
const ready = async (p) => { p.on('pageerror', e => errors.push(e.message)); await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => document.querySelector('#dsc-side .dsc-dm') && !document.body.classList.contains('dsc-booting'), null, { timeout: 40000 }); await p.waitForTimeout(800); };
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await ready(page);
// Bug 1: real clicks on every settings item and on controls inside pages
await page.click('#dsc-user .dsc-user-tool >> nth=2'); await page.waitForTimeout(600);
const labels = await page.evaluate(() => [...document.querySelectorAll('#dsc-settings .dsc-set-item[data-drawer]')].map(x => x.textContent));
const results = [];
for (const label of labels) {
  await page.locator('#dsc-settings .dsc-set-item', { hasText: label }).first().click(); await page.waitForTimeout(700);
  // a control inside the page: the first visible checkbox, select or button-like row
  const ctl = page.locator('.drawer-content.openDrawer :is(label.checkbox_label, select, .inline-drawer-toggle):visible').first();
  if (await ctl.count()) { await ctl.click({ trial: false }).catch(() => {}); await page.waitForTimeout(400); }
  // click empty space on the settings sidebar
  await page.mouse.click(100, 800); await page.waitForTimeout(300);
  results.push([label, await page.evaluate(() => document.body.classList.contains('dsc-settings-open')), await page.evaluate(() => document.querySelector('.dsc-set-title').textContent)]);
}
console.log(JSON.stringify(results));
// lorebook channel
await page.locator('#dsc-settings .dsc-set-book').first().click(); await page.waitForTimeout(800);
console.log('book', await page.evaluate(() => document.body.classList.contains('dsc-settings-open')));
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
console.log('esc closes', !(await page.evaluate(() => document.body.classList.contains('dsc-settings-open'))));
// editor sidebar
await page.click('#dsc-side .dsc-dm >> nth=0'); await page.waitForTimeout(1500);
await page.evaluate(() => { document.querySelector('#rightNavHolder > .drawer-toggle').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await page.waitForTimeout(600);
await page.evaluate(() => document.getElementById('rm_button_selected_ch').click()); await page.waitForTimeout(800);
await page.locator('#dsc-editor .dsc-set-item', { hasText: 'Profile' }).click(); await page.waitForTimeout(400);
await page.mouse.click(100, 800); await page.waitForTimeout(300);
console.log('editor stays', await page.evaluate(() => document.body.classList.contains('dsc-editor-open')));
await page.keyboard.press('Escape'); await page.waitForTimeout(600);
// Bug 2: group chat, click a member's picture
await page.click('#dsc-guilds .dsc-server >> nth=0'); await page.waitForTimeout(2000);
await page.evaluate(() => { const s = SillyTavern.getContext().extensionSettings.discordTheme; s.aside = false; document.body.classList.remove('dsc-aside-on'); });
await page.locator('#chat .mes:not([is_user="true"]) .avatar').first().click(); await page.waitForTimeout(600);
console.log('group avatar popout', await page.evaluate(() => [document.getElementById('dsc-popout')?.querySelector('.dsc-prof-name')?.textContent, !!document.querySelector('.zoomed_avatar')]));
await page.mouse.click(700, 120); await page.waitForTimeout(200);
await page.locator('#chat .mes:not([is_user="true"]) .name_text').nth(1).click(); await page.waitForTimeout(400);
console.log('group name popout', await page.evaluate(() => document.querySelector('#dsc-popout .dsc-prof-name')?.textContent));
await page.keyboard.press('Escape');
// phone
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ready(m);
await m.tap('#dsc-side .dsc-dm >> nth=-1'); await m.waitForTimeout(1500);
await m.locator('#chat .mes:not([is_user="true"]) .avatar').first().tap(); await m.waitForTimeout(600);
console.log('phone sheet', await m.evaluate(() => { const a = document.getElementById('dsc-aside'); const r = a.getBoundingClientRect(); return [document.body.classList.contains('dsc-profile-sheet'), getComputedStyle(a).display, Math.round(r.y), Math.round(r.height), document.querySelector('#dsc-aside .dsc-prof-name')?.textContent]; }));
await m.locator('#dsc-aside .dsc-prof-close').tap(); await m.waitForTimeout(300);
console.log('sheet closed', !(await m.evaluate(() => document.body.classList.contains('dsc-profile-sheet'))));
// phone settings stay open on taps
await m.locator('#dsc-head .dsc-head-back').tap(); await m.waitForTimeout(500);
await m.tap('#dsc-tabs .dsc-tab[data-tab="you"]'); await m.waitForTimeout(500);
await m.locator('#dsc-settings .dsc-set-item', { hasText: 'Chat' }).tap(); await m.waitForTimeout(700);
await m.locator('.drawer-content.openDrawer label.checkbox_label:visible').first().tap(); await m.waitForTimeout(400);
console.log('phone settings stays', await m.evaluate(() => document.body.classList.contains('dsc-settings-open')));
console.log('errors', errors);
await browser.close();
