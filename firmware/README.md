# pwnagotchi-esp32s3 — dumb radio firmware

Standalone ESP32-S3 firmware. The chip does nothing fancy: WiFi sniffing,
channel hopping, EAPOL handshake detection, and an optional deauth burst when
asked. Everything else — mood, hunger, faces, diary, peer logic — lives in
the React Native app and reaches the chip over BLE.

## what the firmware does

- WiFi promiscuous mode on channels 1-13 (hop every ~350 ms)
- Beacon / probe response parsing → maintains a list of nearby APs
- EAPOL handshake detection (M1+M2 of the 4-way exchange is enough)
- BLE GATT server, advertises as `pwn-XXYYZZ` (last 3 MAC bytes)
- Deauth bursts on a target BSSID when commanded by the app

What it explicitly does **not** do:

- No file system, no pcap saving (yet) — handshakes are reported as events,
  the app stores what it cares about
- No screen UI, no buttons
- No WiFi STA / web server / OTA — BLE-only

## BLE protocol

| UUID                                       | properties     | use                          |
|--------------------------------------------|----------------|------------------------------|
| `0000bee5-...`                             | service        | the parent service           |
| `0000bee6-...` STATUS                      | READ + NOTIFY  | 12-byte packed status, 1 Hz  |
| `0000bee7-...` EVENT                       | NOTIFY         | variable-length event stream |
| `0000bee8-...` CONTROL                     | WRITE          | commands from the app        |

### STATUS payload (12 bytes, little-endian)

```
uint32 uptime_sec
uint16 hs_count
uint16 net_count
uint8  channel       // 1..13
uint8  mode          // 0=idle 1=scan 2=hunt 3=sleep
uint8  flags         // bit 0 = ble_connected
uint8  reserved
```

### EVENT payload (variable)

| First byte | meaning              | rest                                |
|------------|----------------------|-------------------------------------|
| `0x10`     | handshake captured   | `[ch][bssid:6][ssid_len][ssid]`     |

### CONTROL payload (variable)

| First byte | command         | rest                |
|------------|-----------------|---------------------|
| `0x01`     | SET_MODE        | `[mode:1]`          |
| `0x02`     | SET_CHANNEL     | `[ch:1]` (0 = hop)  |
| `0x03`     | DEAUTH          | `[bssid:6]`         |
| `0x06`     | WIPE_HS         | (none)              |
| `0xFF`     | REBOOT          | (none)              |

## flashing (one-shot from a desktop, then BLE forever)

1. Push the repo on GitHub. The `build firmware + publish flasher` workflow
   compiles the sketch and deploys a flasher page to GitHub Pages.
2. On any computer with **Chrome or Edge**, open the GitHub Pages URL of the
   repo.
3. Hold the **BOOT** button on the ESP32-S3, plug it in, release after 2 s —
   it enters download mode.
4. Click **Install**. The page writes bootloader + partition table + app via
   WebUSB.
5. After flashing, the chip reboots and advertises `pwn-XXYYZZ` over BLE. Open
   the app, pick this device, you're connected.

## build locally

```sh
arduino-cli core install esp32:esp32 \
  --additional-urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli lib install "NimBLE-Arduino"
arduino-cli compile --fqbn esp32:esp32:esp32s3 \
  --build-property "build.partitions=min_spiffs" pwnagotchi-esp32s3
```

## why this split

The phone has the brain. The ESP32 is the antenna. Three concrete wins:

- The radio firmware stays under 500 lines, easy to audit.
- Iteration speed is RN-fast: change a mood / face / diary entry and reload
  the app, no reflash.
- BLE doesn't fight WiFi monitor mode for the radio — they live on separate
  ESP32-S3 RF blocks.

## roadmap

- v0.1 (this): sniff + deauth + BLE
- v0.2: store handshake pcap chunks in flash, expose via a 4th characteristic
- v0.3: pwngrid-compatible peer beacons (so the app can show "other pwnagotchis nearby")
- v0.4: BLE OTA (currently OTA is only possible by re-flashing via the web flasher)
