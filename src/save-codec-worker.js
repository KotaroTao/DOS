import { replayCloudCommand } from "./cloud-command-replay.js";
import { decodeCommandResponse } from "./cloud-command-codec.js";
import { createCloudChange } from "./cloud-change.js";
import { refSerialize, acknowledgedSave } from "./savegraph.js";
self.onmessage = async ({ data: { id, op, value, packet, compact } }) => {
  try {
    const result = op === "replayCommand" ? await replayCloudCommand(value, packet.command, packet.commandId, packet.forcedTurns) : op === "commandReply" ? decodeCommandResponse(value, packet) : op === "change" ? createCloudChange(value, packet) : op === "encode" ? JSON.stringify(refSerialize(value, { compact })) : acknowledgedSave(value, packet);
    self.postMessage({ id, result });
  } catch (e) { self.postMessage({ id, error: e.message }); }
};
