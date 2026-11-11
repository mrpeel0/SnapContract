import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { handleInbound, joinCode, plainText, type Adapter, type OutMsg } from "./core";

// iMessage through the Messages app on this Mac.
// Outbound: AppleScript. Inbound: poll ~/Library/Messages/chat.db (needs Full Disk Access).
const run = promisify(execFile);
const DB = path.join(os.homedir(), "Library", "Messages", "chat.db");
const SQLITE = "/usr/bin/sqlite3";

const enabled = () => process.platform === "darwin" && /^(1|true|yes)$/i.test(process.env.IMESSAGE_ENABLED ?? "");
const handle = () => process.env.IMESSAGE_HANDLE ?? "";

const g = globalThis as unknown as { __imGen?: number; __imError?: string | null };

const SEND_SCRIPT = [
  "on run argv",
  "set theHandle to item 1 of argv",
  "set theText to item 2 of argv",
  'tell application "Messages"',
  "set svc to 1st account whose service type = iMessage",
  "try",
  "send theText to participant theHandle of svc",
  "on error",
  "send theText to buddy theHandle of svc",
  "end try",
  "end tell",
  "end run",
];

async function send(to: string, out: OutMsg) {
  const text = plainText(out, { buttonsAsText: true });
  await run("osascript", [...SEND_SCRIPT.flatMap((l) => ["-e", l]), to, text], { timeout: 15_000 });
}

async function query<T>(sql: string): Promise<T[]> {
  const { stdout } = await run(SQLITE, ["-readonly", "-json", DB, sql], { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 });
  return stdout.trim() ? (JSON.parse(stdout) as T[]) : [];
}

/** Newer macOS stores message text only in the typedstream `attributedBody` blob. */
function decodeAttributedBody(hex: string | null) {
  if (!hex) return "";
  const buf = Buffer.from(hex, "hex");
  const at = buf.indexOf("NSString");
  if (at < 0) return "";
  let i = at + "NSString".length + 5;
  let len = buf[i];
  i += 1;
  if (len === 0x81) {
    len = buf.readUInt16LE(i);
    i += 2;
  } else if (len === 0x82) {
    len = buf.readUInt32LE(i);
    i += 4;
  }
  return buf.subarray(i, i + len).toString("utf8");
}

type Row = { id: number; sender: string; text: string | null; body: string | null };

async function poll(gen: number) {
  let last = -1;
  while (g.__imGen === gen && enabled()) {
    try {
      if (last < 0) {
        const [r] = await query<{ id: number | null }>("SELECT MAX(ROWID) AS id FROM message;");
        last = r?.id ?? 0;
      }
      const rows = await query<Row>(
        `SELECT m.ROWID AS id, h.id AS sender, m.text AS text, hex(m.attributedBody) AS body
         FROM message m JOIN handle h ON h.ROWID = m.handle_id
         WHERE m.ROWID > ${last} AND m.is_from_me = 0 AND m.item_type = 0 AND m.associated_message_type = 0
           AND (m.cache_roomnames IS NULL OR m.cache_roomnames = '')
         ORDER BY m.ROWID LIMIT 50;`,
      );
      if (g.__imError) console.log("[imessage] connected to Messages");
      g.__imError = null;
      for (const r of rows) {
        last = Math.max(last, r.id);
        const text = (r.text || decodeAttributedBody(r.body)).replace(/￼/g, "").trim();
        if (!text) continue;
        try {
          await handleInbound("imessage", r.sender, text, { reply: (o) => send(r.sender, o) });
        } catch (e) {
          console.error("[imessage] inbound", e);
        }
      }
    } catch (e) {
      const msg = (e as Error).message;
      const err = /authorization denied|unable to open/i.test(msg)
        ? "Grant Full Disk Access to your terminal (System Settings → Privacy & Security), then restart the server."
        : msg.split("\n")[0];
      if (err !== g.__imError) console.error("[imessage]", err);
      g.__imError = err;
      await new Promise((r) => setTimeout(r, 5000));
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

export const imessage: Adapter = {
  kind: "imessage",
  configured: enabled,
  send,
  async info(projectId) {
    const h = handle();
    if (!h) return { address: null, links: null, error: "Set IMESSAGE_HANDLE to the phone or email people should text" };
    const link = (role: "contractor" | "client") => `sms:${h}&body=${encodeURIComponent(`join ${joinCode(role, projectId)}`)}`;
    return { address: h, links: { contractor: link("contractor"), client: link("client") }, error: g.__imError ?? null };
  },
  setup: ["macOS only · Messages signed in", "IMESSAGE_ENABLED=1 IMESSAGE_HANDLE=you@icloud.com", "Full Disk Access for your terminal"],
};

export function startIMessage() {
  if (!enabled()) return;
  const gen = (g.__imGen = (g.__imGen ?? 0) + 1);
  void poll(gen);
}
