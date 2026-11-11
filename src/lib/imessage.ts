import { deliverChannel } from "./messaging";

export function imessageConfigured() {
  return Boolean(process.env.IMESSAGE_API_KEY);
}

export async function sendIMessage(to: string, text: string, actions?: { id: string; title: string }[]) {
  const key = process.env.IMESSAGE_API_KEY;
  if (!key) return;
  const hint = actions?.length
    ? `\n\nReply ${actions.map((a) => `${a.title.toUpperCase()} ${a.id.split(":")[1] ?? ""}`.trim()).join(" or ")}`
    : "";
  const body = `${text}${hint}`.slice(0, 4000);
  const url = process.env.IMESSAGE_API_URL || "https://server.loopmessage.com/api/v1/message/send";
  const sender = process.env.IMESSAGE_SENDER;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      contact: `+${to}`,
      recipient: `+${to}`,
      text: body,
      message: body,
      ...(sender ? { sender } : {}),
    }),
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 300) || `iMessage send failed (${res.status})`);
}

export async function notifyIMessage(projectId: string) {
  if (!imessageConfigured()) return;
  await deliverChannel(projectId, "imessage", sendIMessage);
}
