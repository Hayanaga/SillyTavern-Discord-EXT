// Collects every user-visible string the theme passes through t() (directly, or as a label,
// title, note, heading or placeholder in its tables), and the text of settings.html.
// node tools/strings.mjs → prints them as JSON; --write updates locales/en.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
/** Every string the theme shows, by reading its code. */
export function collect() {
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
const found = new Set();
const unq = s => s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
for (const file of files) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)+)'\s*\)/g)) found.add(unq(m[1]));
    for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"\s*\)/g)) found.add(unq(m[1]));
    for (const m of src.matchAll(/\bt\(\s*`([^`$]+)`\s*\)/g)) found.add(m[1]);
    for (const m of src.matchAll(/\b(label|title|note|heading|placeholder|tip|name)\s*:\s*'((?:[^'\\]|\\.)+)'/g)) found.add(unq(m[2]));
    // [key, 'Label'] pairs in option lists
    for (const m of src.matchAll(/\[\s*'[A-Za-z0-9#-]*'\s*,\s*'((?:[^'\\]|\\.)+)'\s*\]/g)) found.add(unq(m[1]));
    // words handed to the theme's own helpers, which translate them (switchRow, section, button, tool, …)
    // t(a ? 'One' : 'Other') and the like
    for (const m of src.matchAll(/\bt\(((?:[^()]|\([^()]*\))*)\)/g)) {
        for (const lit of m[1].matchAll(/'((?:[^'\\]|\\.)+)'/g)) found.add(unq(lit[1]));
    }
    // one pass per helper, so calls nested inside others are found too
    for (const helper of ['switchRow', 'section', 'button', 'tool', 'headButton', 'railItem', 'iconButton', 'toast', 'heading', 'navRow']) {
        const call = new RegExp(`\\b${helper}\\(((?:[^()]|\\((?:[^()]|\\([^()]*\\))*\\))*)\\)`, 'g');
        for (const m of src.matchAll(call)) {
            for (const lit of m[1].matchAll(/'((?:[^'\\]|\\.)+)'/g)) found.add(unq(lit[1]));
        }
    }
}
const html = fs.readFileSync(path.join(ROOT, 'settings.html'), 'utf8');
for (const m of html.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) {
    const text = m[1].replace(/\s+/g, ' ').trim();
    if (text) found.add(text);
}
// the shared one-theme file translates its own few words with tr()
const shared = fs.readFileSync(path.join(ROOT, 'lib/theme-exclusive.js'), 'utf8');
for (const m of shared.matchAll(/\btr\(\s*'((?:[^'\\]|\\.)+)'\s*\)/g)) found.add(unq(m[1]));
// text the styles draw, handed over as --dsc-t-* variables (index.js CSS_TEXT)
const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
for (const m of index.matchAll(/\['[a-z-]+', '((?:[^'\\]|\\.)+)'\]/g)) found.add(unq(m[1]));
// not words: ids, css, code, short codes ({0}-style blanks are words' places, and stay)
const keep = [...found].filter(s => /[A-Za-z]{2}/.test(s) && !/^[a-z0-9_-]+$/.test(s) && !/^--|^#|^\.|=>|\$\{|\n|;|function |\{(?!\d\})|(?<!\{\d)\}/.test(s) && !/^[a-z]+[A-Z][A-Za-z]*$/.test(s) && !/^dsc-|^[a-z]+_[a-z_]+$/.test(s)).sort();
return keep;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
const keep = collect();
if (process.argv.includes('--write')) {
    fs.mkdirSync(path.join(ROOT, 'locales'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'locales/en.json'), `${JSON.stringify(Object.fromEntries(keep.map(s => [s, s])), null, 4)}\n`);
}
console.log(JSON.stringify(keep.length));
}
