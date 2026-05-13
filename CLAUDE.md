# cocogotchi — context for future Claude sessions

## What this is

A "pwnagotchi"-style mobile pet that lives in a React Native app and gets fed
by real WiFi handshakes captured by a companion ESP32-S3.

**Architecture** — the phone has the brain, the ESP32 is a dumb radio.

```
┌──────────────────┐    BLE    ┌──────────────────┐
│  ESP32-S3        │ ←──────→  │  Expo / RN app   │
│  ~500 LOC C++    │           │  (mood, diary,   │
│  WiFi monitor    │ events:   │   hunger, faces) │
│  EAPOL detect    │ handshake │                  │
│  channel hop     │ status:   │  persisted in    │
│  deauth on cmd   │ 12 bytes  │  AsyncStorage    │
└──────────────────┘           └──────────────────┘
```

## Repos / URLs

- GitHub repo: `git@github.com:riyot/cocogotchi.git`
- Web flasher (auto-built by CI on push): `https://riyot.github.io/cocogotchi/`
- GitHub Pages source: **GitHub Actions** (set manually in repo Settings → Pages)

## User context

- **riyot** develops 100 % on a phone running **GrapheneOS** with Termux +
  PRoot Arch Linux. No PC available most of the time.
- Privacy-focused: Vanadium browser, no Play Store by default, F-Droid first.
- USB Host on GrapheneOS is locked down — flashing the ESP32 requires a
  desktop with real Chrome/Edge (rare opportunity). All subsequent firmware
  iterations must come from the phone, either over BLE (target) or by
  pushing a commit and using the web flasher again from a borrowed PC.
- Reads / writes French in chat, prefers terse cyberpunk-style language in the
  app's diary entries.

## Project state (last known)

| Area              | State                                                         |
|-------------------|---------------------------------------------------------------|
| Expo app          | Working in Expo Go SDK 55, mock backend, persistence in place |
| Tabs              | home, diary, friends, diet, menu — all functional             |
| Face animator     | Multi-frame per mood + particles + 15 spontaneous jokes       |
| Being store       | Birth screen, AsyncStorage, time-decaying hunger/energy/health |
| ESP service       | Router (mock + http). BLE service NOT written yet.            |
| Firmware          | Compiles, published via GH Actions + Pages                    |
| Flash             | Done at least once. Awaiting confirmation it actually boots.  |
| BLE link          | Verification pending (see open question below)                |

## Open questions / next steps

- After flashing, the user reported **no output in the esp-web-tools serial
  console** and **no `pwn-XXXXXX` device in nRF Connect**. The last commit
  added `boot_app0.bin` at 0xE000 — needed for OTA partition tables. Re-flash
  and recheck.
- If still nothing: connect serial (115200 baud) on a desktop, look at boot
  log. Possibilities: BLE/WiFi init crash, partition mismatch, bad merge.
- Once the ESP advertises: write `services/esp-ble.ts` and eject from Expo Go
  via `expo-dev-client` + `react-native-ble-plx`. EAS Build dev client is the
  way (no admin needed on the user's setup).

## Layout

```
app/                          Expo Router screens
  _layout.tsx                 root Stack
  index.tsx                   redirector (birth if no being, else (tabs))
  birth.tsx                   naming + personality picker
  (tabs)/
    _layout.tsx               Tabs nav, custom retro glyphs (⌂ ▤ ◉ ✦ ☰)
    index.tsx                 HOME: face + vitals + status + log
    diary.tsx                 cyberpunk diary feed
    friends.tsx               discovered networks
    diet.tsx                  captured handshakes as "meals"
    menu.tsx                  identity, lifetime, vitals, esp-link toggle

components/                   reusable visual blocks
  pwnagotchi-face.tsx         calls useFaceAnimator, renders particles
  particle-layer.tsx          floating z / sparkle / glitch / matrix / heart
  status-bar.tsx              CH / APS / HS / DEAUTH / UP
  vitals.tsx                  HUNGER hearts + ENERGY + HEALTH bars
  event-log.tsx               recent ESP events scrolling list

hooks/
  use-being.ts                load + subscribe to BeingStore singleton
  use-esp.ts                  status + recentEvents from EspRouter
  use-face-animator.ts        per-mood frame cycling + spontaneous actions

services/
  being-types.ts              Being / DiaryEntry / Friend types
  being-store.ts              singleton with tick loop, persistence, ESP wiring
  diary-writer.ts             cyberpunk one-liners by kind
  esp.ts                      EspService interface + types
  esp-mock.ts                 MockEspService — fake events + state machine
  esp-http.ts                 HttpEspService — polls /status + /scan
  esp-router.ts               singleton: swaps inner between mock and http
  esp-config.ts               persisted { mode: 'mock' | 'http', baseUrl }

constants/
  faces.ts                    legacy FaceName → ASCII (used by mock + types)
  face-variants.ts            MOOD_FRAMES + MOOD_PARTICLES (animator)
  actions.ts                  ACTIONS[] — 15 spontaneous jokes (pickRandomAction)
  theme.ts                    colors + fonts.mono

firmware/
  pwnagotchi-esp32s3/         single-file Arduino sketch (≈500 LOC)
    pwnagotchi-esp32s3.ino    BLE GATT + WiFi promiscuous + EAPOL
  web/
    index.html                esp-web-tools `<esp-web-install-button>`
    manifest.template.json    parts: bootloader / partitions / boot_app0 / app
  README.md                   BLE protocol spec + flashing procedure

.github/workflows/
  build-firmware.yml          arduino-cli compile, assemble site, deploy Pages
```

## BLE protocol (firmware ↔ app)

Service `0000bee5-0000-1000-8000-00805f9b34fb`

| char    | UUID suffix   | props            | payload                                    |
|---------|---------------|------------------|--------------------------------------------|
| STATUS  | …bee6         | read + notify    | 12 bytes packed: u32 uptime, u16 hs, u16 nets, u8 ch, u8 mode, u8 flags, u8 reserved |
| EVENT   | …bee7         | notify           | `[type:1][rest]`. type 0x10 = HS captured  |
| CONTROL | …bee8         | write            | `[cmd:1][payload]`. cmds: 0x01 SET_MODE, 0x02 SET_CHANNEL, 0x03 DEAUTH, 0x06 WIPE_HS, 0xFF REBOOT |

## Conventions to keep

- French in chat, English in code (incl. comments, commit messages, docs).
- Cyberpunk lowercase voice in any user-facing strings.
- Tabs nav uses ASCII glyphs (no Material/Ionicons).
- No emojis in code or commits unless the user asks.
- Don't reintroduce Tasmota, Marauder, or Bruce as a dependency — the user
  rejected those paths: he wants a clean standalone firmware that only does
  the radio bits, with all the personality logic on the phone.
- ESP32 firmware must stay flashable from esp-web-tools (Chrome/Edge desktop)
  and must support BLE OTA later for in-app updates.

## How to run locally (on the phone)

```bash
cd /root/projets/mon-app
CI=1 npx expo start          # CI=1 because PRoot has no inotify
# in Expo Go: exp://localhost:8081
```

`CI=1` disables file watching → after edits, reload manually via Expo Go dev
menu. If you want auto-reload, drop `CI=1`, but Metro will warn about watchers
on PRoot.

## How to ship a firmware update today (until BLE OTA lands)

1. Edit `firmware/pwnagotchi-esp32s3/pwnagotchi-esp32s3.ino`
2. `git push` — GH Actions rebuilds, publishes the new `.bin` to Pages
3. On a desktop with Chrome/Edge, open `https://riyot.github.io/cocogotchi/`,
   plug the ESP32 with BOOT held, click **Install**

## Recent known issue (2026-05-13)

After a fresh flash, no serial output and no BLE device named `pwn-*`.
The fix in commit `f200beb` adds `boot_app0.bin` at offset `0xE000` to the
manifest. Re-flash with the new build before debugging further. If output
is still empty, suspect: wrong baud rate (firmware uses 115200), or the
partition table mismatch with the chip variant.
