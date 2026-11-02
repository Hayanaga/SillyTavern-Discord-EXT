// Unit tests for theme-exclusive.js. Run: node --test 'test/*.test.mjs'
import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() {} }) };
const { pickWinner, listNames, KNOWN_THEMES, THIRD_PARTY_THEMES, PRESET_CLASSES } = await import('../lib/theme-exclusive.js');

test('the most recently turned on theme wins', () => {
    assert.equal(pickWinner([{ id: 'discord', activatedAt: 100 }, { id: 'imessage', activatedAt: 200 }]).id, 'imessage');
    assert.equal(pickWinner([{ id: 'imessage', activatedAt: 300 }, { id: 'discord', activatedAt: 200 }]).id, 'imessage');
});

test('a stamped theme beats one never stamped', () => {
    assert.equal(pickWinner([{ id: 'discord' }, { id: 'yodayo', activatedAt: 1 }]).id, 'yodayo');
});

test('equal or missing times go to the same theme in every copy', () => {
    const a = pickWinner([{ id: 'msteams' }, { id: 'discord' }, { id: 'imessage' }]).id;
    const b = pickWinner([{ id: 'imessage' }, { id: 'msteams' }, { id: 'discord' }]).id;
    assert.equal(a, 'discord');
    assert.equal(b, 'discord');
});

test('no candidates, no winner', () => {
    assert.equal(pickWinner([]), null);
});

test('names read naturally', () => {
    assert.equal(listNames([]), '');
    assert.equal(listNames(['iMessage']), 'iMessage');
    assert.equal(listNames(['iMessage', 'Moonlit Echoes']), 'iMessage and Moonlit Echoes');
    assert.equal(listNames(['iMessage', 'Microsoft Teams', 'Moonlit Echoes']), 'iMessage, Microsoft Teams and Moonlit Echoes');
    assert.equal(listNames(['Moonlit Echoes', 'Moonlit Echoes']), 'Moonlit Echoes');
});

test('our themes are known, each with a unique id, folder, key and class', () => {
    assert.equal(KNOWN_THEMES.length, 5);
    for (const field of ['id', 'folder', 'settingsKey', 'bodyClass']) {
        assert.equal(new Set(KNOWN_THEMES.map(x => x[field])).size, 5, field);
    }
});

test('none of our themes is in the third-party list', () => {
    for (const theme of KNOWN_THEMES) {
        assert.equal(Object.hasOwn(THIRD_PARTY_THEMES, theme.folder), false, theme.folder);
    }
    assert.ok(Object.hasOwn(THIRD_PARTY_THEMES, 'SillyTavern-MoonlitEchoesTheme'));
});

test('only look-related classes are held back', () => {
    for (const name of ['hideChatAvatars', 'no-blur', 'noShadows']) {
        assert.equal(PRESET_CLASSES.includes(name), false, name);
    }
});
