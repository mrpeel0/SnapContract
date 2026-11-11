import { notifyIMessage } from "./imessage";
import { notifyTelegram } from "./telegram";
import { notifyWhatsApp } from "./whatsapp";

export async function notifyChannels(projectId: string) {
  await Promise.all([
    notifyTelegram(projectId).catch((e) => console.error("telegram notify", e)),
    notifyWhatsApp(projectId).catch((e) => console.error("whatsapp notify", e)),
    notifyIMessage(projectId).catch((e) => console.error("imessage notify", e)),
  ]);
}
