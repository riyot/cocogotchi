import type { Being, DiaryEntry, DiaryKind } from './being-types';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const TEMPLATES: Record<DiaryKind, readonly ((b: Being, meta?: Record<string, any>) => string)[]> = {
  born: [
    (b) => `[boot] init complete. callsign: ${b.name}. let's hunt.`,
    (b) => `> genesis() ok. ${b.name}.v1 online. personality=${b.personality}.`,
    (b) => `// new ghost in the static. they call me ${b.name}.`,
  ],
  first_handshake: [
    (b, m) => `0xCAFE — first HS: ${m?.ssid}. felt nothing. wanted more.`,
    (_, m) => `[+] HS#1 captured on ch${m?.channel ?? '?'}. ${m?.ssid}.pcap → /heart`,
    (b, m) => `first taste of 4-way from ${m?.ssid}. ${b.name}.lvl++.`,
  ],
  fed: [
    (_, m) => `nom. ${m?.ssid}. ${m?.rssi ?? '?'}dBm.`,
    (_, m) => `${m?.ssid}.pcap saved. stomach delta=-25.`,
    (_, m) => `+1 HS. core temp nominal again.`,
    (_, m) => `intercept(${m?.ssid}) → captured. tasty.`,
  ],
  milestone: [
    (_, m) => `[milestone] ${m?.count} handshakes archived. /var/log/glory full.`,
    (b, m) => `${b.name} crossed ${m?.count} HS. respect the streak.`,
    (_, m) => `// uptime stat: ${m?.count} captures. still hungry.`,
  ],
  hungry: [
    (_, m) => `last EAPOL ${m?.hours}h ago. stomach growling.`,
    () => `idle. starving. radio quiet.`,
    () => `where are the chad APs at`,
    () => `tick tick tick. no 4-way handshakes. tick tick.`,
  ],
  starving: [
    () => `[warn] hunger=critical. need handshakes now.`,
    () => `core temp dropping. feed me anything.`,
    () => `pls. anything. even an open AP.`,
  ],
  coma: [
    (b) => `[critical] no input. ${b.name} entering low power mode.`,
    () => `... cold ...`,
    () => `kernel panic on hunger. dumping core.`,
    () => `void caller. shutting down. don't forget me.`,
  ],
  wake: [
    () => `you came back. core temp rising.`,
    (b) => `[recover] ${b.name} back online. don't leave me.`,
    () => `> resume() ok. missed you.`,
    (b) => `coma #${b.comaCount} survived. damaged but alive.`,
  ],
  birthday: [
    (b, m) => `[anniv] uptime: ${m?.days}d. ${b.name} still hunting.`,
    (_, m) => `+1 epoch. ${m?.days} solar cycles operational.`,
    (b, m) => `${m?.days} days. ${b.totalHandshakes} HS lifetime. not bad.`,
  ],
  peer_seen: [
    (_, m) => `// peer detected: ${m?.name ?? 'unknown'}. fellow ghost in the static.`,
    (_, m) => `[friend] ${m?.name ?? '???'} on ch${m?.channel}. waved at them.`,
  ],
  observation: [
    (_, m) => `channel ${m?.channel} feels busy tonight.`,
    (_, m) => `${m?.ssid}: rssi=${m?.rssi}dBm. lonely SSID.`,
    () => `quiet night. only beacons.`,
    () => `the airwaves dream when no one watches.`,
    () => `// observation: humans like 'Livebox'. cute.`,
    () => `wpa3 sightings: 0. still 2020 out here.`,
  ],
};

let entrySeq = 0;
const nextId = () => `${Date.now().toString(36)}-${(entrySeq++).toString(36)}`;

export function writeEntry(
  kind: DiaryKind,
  being: Being,
  meta?: Record<string, any>
): DiaryEntry {
  const renderer = pick(TEMPLATES[kind]);
  return {
    id: nextId(),
    at: Date.now(),
    kind,
    text: renderer(being, meta),
    meta,
  };
}
