import { refSerialize, refDeserialize } from "./savegraph.js";
import { applyCloudChange } from "./cloud-change.js";
// JSONBのキー順とブラウザのキー順に依存しない基準を作る。
export function commandPacketBase(graph) {
  const ordered = value => {
    if (Array.isArray(value)) return value.map(ordered);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, ordered(value[k])]));
  };
  const s = refDeserialize(ordered(graph)), snapshot = {};
  for (const k of ["battle", "party", "reserve", "souls", "rng", "codex", "gold", "soulPts", "run", "inventory"]) snapshot[k] = s[k];
  if (Array.isArray(s.formations)) snapshot.formations = s.formations;
  return refSerialize({ snapshot, result: null, logs: [], modFeed: [] }, { compact: true });
}
export function decodeCommandResponse(graph, response) {
  const base = commandPacketBase(graph);
  const unpack = value => value.snapshot || applyCloudChange(base, value.change);
  return { ...response, packet: unpack(response.packetChange), nextPacket: response.nextPacketChange ? unpack(response.nextPacketChange) : null };
}
