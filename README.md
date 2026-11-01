# Discord Theme for SillyTavern

A SillyTavern extension that makes SillyTavern look and work like Discord after its 2025 redesign, on desktop and on phones, in Discord's four themes: Dark (the default), Ash, Onyx and Light.

![A direct message](.github/dm.png)

## What you get

- **Server rail.** The Discord button at the top opens your direct messages. Below it, each group shows as a server (its picture, or its initials like Discord's), followed by Add a Server and Discover. The white pill marks the server you're in.
- **Direct messages and channels.** At home, the list shows Friends, Nitro and Shop, then one direct message per character you've talked to, newest first. You can pin a DM or close it. Pick a server and the list shows its channels instead (each group chat is a channel), under the server's name and menu.
- **Your panel** at the bottom with your persona's picture (or a Discord default avatar), name and status. It also has mute, deafen and the settings gear.
- **Discord's message flow.** Every message gets a 40px round picture, a name and "Today at 4:20 PM". A follow-up from the same person within seven minutes joins the one before, and its time shows in the gutter when you point at it. A date line starts each day. The action bar appears at the top right when you hover, and there's an optional compact mode.
- **The message box.** It reads "Message @name" or "Message #channel". The round + on the left opens the chat options. On the right, gift, GIF, sticker and emoji run Continue, Regenerate, Impersonate and the extensions menu. Enter sends.
- **Header.** It shows @name or #channel, the server's name, and buttons for a new chat, chat history, pinning the chat, converting a DM to a group, and showing the profile panel or member list. It also has search (which opens the Quick Switcher), Inbox and Help.
- **Profile panel and member list.** In a DM you get the character's profile, with a banner tinted from their picture, About Me, Member Since and Mutual Servers. In a server you get its members, with muted ones listed as offline.
- **Discover** (the compass on the rail) shows every character and server as Discord discovery cards. It has search, the All / Favorites / Recent / Servers tabs, and buttons for New Character, Import, Import from URL and New Server.
- **Friends page.** It shows when no chat is open. The Online and All tabs list your characters with message and more buttons. Add Friend starts a new character, and the Active Now column sits on the right.
- **Settings like Discord's.** They open full screen with the sections on the left and the close button with ESC. The sections are My Account, Connections, Appearance, Chat, Advanced, Backgrounds and Keybinds, then AI Config, Context Template, Instruct Template, System Prompt, World Info and Extensions; long menus are split so each page holds one topic, and your lorebooks are listed as channels under World Info. A character opens as a Profile page (Profile, Definitions, Lorebook, Export, Duplicate, Delete Character) and a group as Server Settings (Overview, Members, Add Members, Scenario, Delete Server). Each section is SillyTavern's own menu, laid out as a Discord form: one column, uppercase titles, Discord fields, and green switches in rows with dividers.
- **Nitro color themes.** The Appearance page shows Discord's theme picker. The first row has round swatches for Light, Ash, Dark, Onyx and Sync. Under **Color** come all 24 Nitro gradient themes: Mint Apple, Citrus Sherbert, Retro Raincloud, Hanami, Sunrise, Cotton Candy, Lofi Vibes, Desert Khaki, Easter Egg, Sunset, Chroma Glow, Forest, Crimson Moon, Midnight Blurple, Mars, Dusk, Under the Sea, Retro Storm, Neon Nights, Strawberry Lemonade, Aurora, Sepia, Blurple Twilight and Hexagon. They use Discord's own gradients and tints: every panel is a see-through veil over one continuous gradient, and text and surfaces take on the theme's tint, on desktop and phones.
- **Profile collectibles.** Every character and persona wears Discord's shop items: an avatar decoration around their picture, a nameplate behind their name in the DM and member lists, a profile effect over their profile, and a profile frame around it. All 700 decorations, 297 nameplates, 367 effects and 71 frames are listed, and each character gets its own, picked once and kept. **Change Look** on a profile swaps them, with search, and you can add your own PNG, APNG, GIF, WebP, AVIF, WebM or MP4 files. Lists show a still and play on hover; profiles play them.
- **Offline copies.** The art loads from Discord's file server. Under Change Look > **Offline Copies** you can save it on your SillyTavern server instead: every kind, the ones in use, or item by item, with a size breakdown first. Then turn on **Use only saved copies** and nothing is loaded from Discord. Most of Discord's files need SillyTavern's CORS proxy to be saved: set `enableCorsProxy: true` in `config.yaml` and restart SillyTavern.
- **Short messages.** A long reply shows as several short messages, a sentence or two each, like texting. Each has its own row with hover and time. A fresh reply comes in part by part with the typing dots between. It's still one message underneath, so edit, swipe, delete and regenerate work on the whole thing. The splitter never cuts inside quotes, *actions*, code, lists or tables.
- **Reactions.** React to any message from the hover bar's smiley or the right-click menu, with Discord's picker and recent emoji. Reactions show as pills under the message, and clicking one adds or takes back yours. They're saved with the chat and never sent to the AI.
- **Image links as pictures.** A link to an image (png, jpg, gif, webp…) or a markdown image shows as the picture, like a Discord image embed: its own shape, at most 550×350, with a click-to-enlarge viewer. This works even while SillyTavern's Forbid External Media is on, and the extension's settings can turn it off.
- **Presence.** Characters show Discord's online, idle, do-not-disturb or offline status everywhere: DMs, the header, member lists, profiles, Friends and Discover. Someone you've talked with recently is online, and others drift to idle and then offline. When you write to someone who's away, they come online after a moment, then "X is typing…" shows until the reply arrives. Swipes, regenerations and continues never wait. You can turn it off or change the delay in the extension's settings.
- **Sounds.** Discord-like sounds are made in the browser, with no audio files: a message ping when a reply arrives while the window isn't in front, a chime when someone comes online, and tones for mute, unmute, deafen and undeafen. Deafen silences everything. The extension's settings have volume and a switch for each sound.
- **Quick Switcher** (Ctrl+K, or ⌘K on a Mac). It jumps to anyone, any channel or any server. Start with @, # or * to narrow the results.
- **Keyboard shortcuts** follow Discord's set and show the right keys for your OS: Ctrl/⌘+K, Ctrl/⌘+/ for the keybinds list, Ctrl/⌘+, for settings, Alt+↑/↓ for conversations, Ctrl/⌘+Alt+↑/↓ for servers, Ctrl/⌘+' for a new chat, Ctrl/⌘+P to pin, Ctrl/⌘+U for the member list, Ctrl/⌘+I for chat history and Ctrl/⌘+E for extensions.
- **Phones** follow Discord mobile. You see the server rail with your conversations and the Home / Notifications / You tabs; Notifications lists recent messages. A conversation slides in full screen with a pill message box and a send button. Tapping a message shows its actions, and You opens the settings as a list.
- **Disguise.** The tab reads "Discord | @name" and shows Discord's icon. The loading screen is Discord's, with a tip, and SillyTavern's name doesn't appear in the themed UI. Turning the theme off puts everything back exactly.

## Gallery

### Desktop

| | |
|---|---|
| ![A reply split into short messages, with the typing dots](docs/screenshots/chat-dark.webp) | ![A Nitro color theme (Chroma Glow)](docs/screenshots/nitro.webp) |
| Short messages and typing dots (Dark) | Nitro color theme (Chroma Glow) |
| ![A server with its member list and a folder in the rail](docs/screenshots/server-members.webp) | ![A profile popout](docs/screenshots/profile-popout.webp) |
| A server, its member list and a server folder | Profile popout |
| ![Search results](docs/screenshots/search.webp) | ![Pinned messages](docs/screenshots/pins.webp) |
| Search | Pinned messages |
| ![User Settings, Appearance, in Light](docs/screenshots/settings-light.webp) | ![The Customize page](docs/screenshots/customize.webp) |
| User Settings (Light) | Customize |
| ![Creating a server](docs/screenshots/add-server.webp) | |
| Add a Server | |

### Phone

| | | |
|---|---|---|
| ![The phone home screen](docs/screenshots/phone-home.webp) | ![A conversation on a phone](docs/screenshots/phone-chat.webp) | ![User Settings on a phone, in Light](docs/screenshots/phone-settings-light.webp) |
| Home | A conversation | User Settings (Light) |

`node tools/gallery.mjs` retakes these on the clean test profile. `node tools/social-preview.mjs` takes its own shots the same way and renders the repository's social preview ([docs/social-preview.png](docs/social-preview.png)).

## Install

In SillyTavern, open **Extensions → Install extension** and paste:

```
https://github.com/pervertir/SillyTavern-Discord
```

Then open **Extensions**, find **Discord Theme** and set it up:

- **Enable theme**
- **Appearance**: Dark, Ash, Onyx, Light, or sync with your computer
- **Color theme (Nitro)**: any of Discord's 24 gradient color themes, or none
- **Message display**: cozy or compact
- **Show the profile panel and member list**
- **Show characters as online**
- **Discord-style message times**
- **Conversations in the list**

Turn off other UI themes (Moonlit Echoes, Yodayo Tavern, Microsoft Teams) while this one is on.

### Optional: Discord's loading screen from the first frame

SillyTavern draws its own logo before any extension loads. To show Discord's loading screen from the very start, append [`extras/discord-splash.css`](extras/discord-splash.css) to `data/_css/user.css` in your SillyTavern folder. Delete that block to undo it.

## Notes

- The sizes, colors and type follow Discord's own design values, collected in [docs/discord-ui-notes.md](docs/discord-ui-notes.md).

- The font is gg sans if it's installed on your computer. Otherwise it falls back to Noto Sans, loaded from Google Fonts.
- Requires SillyTavern 1.19.0 or newer.
- The theme speaks SillyTavern's language: pick one under Settings > Advanced > Language (SillyTavern reloads). All of SillyTavern's languages are included (`locales/`); Arabic reads right to left.

## Development

- While it's off, the theme leaves no trace in SillyTavern's page: no elements, classes, attributes or styles, and its handlers do nothing (see `life.js`). Only its own options in the Extensions list remain.
- `npm test` runs the unit tests.
- Every word the theme shows goes through `t()`. After adding or changing one, run `node tools/strings.mjs --write` to update `locales/en.json`, then add it to every other file in `locales/`. The unit tests fail if a locale is missing a string, and the check fails if any of the theme's words show in English while SillyTavern is set to German.
- `npm run check` runs everything that must pass before a push:
  - the unit tests;
  - the zero-traces test, with the theme off at load, turned off live, and turned off again after turning it back on;
  - the regression scripts, the accessibility audit (names, alt text, contrast in every base theme, visible keyboard focus) and the surfaces check (no gradient, shadow or blur around the forms; the corner under your panel belongs to the rail) in `test/e2e/`.

  It starts its own clean SillyTavern test server and stops it when done, and drives headless browsers only. The paths are in `test/e2e/env.mjs` and `tools/check.mjs`, and can be overridden with `DSC_*` environment variables.
- To run the check automatically before every push, turn on the hook once per clone with `git config core.hooksPath .githooks`.

## License

MIT
