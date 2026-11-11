import { getProject, mutate } from "../db";
import type { ChannelKind, Project, Role } from "../types";
import { buildOutbound, CHANNEL_LABEL, type Adapter } from "./core";
import { imessage, startIMessage } from "./imessage";
import { startTelegram, telegram } from "./telegram";
import { whatsapp } from "./whatsapp";

export const ADAPTERS: Adapter[] = [whatsapp, imessage, telegram];

export interface ChannelInfo {
  kind: ChannelKind;
  label: string;
  enabled: boolean;
  address: string | null;
  links: { contractor: string; client: string } | null;
  linked: Record<Role, boolean>;
  error: string | null;
  setup: string[];
}

export async function channelsInfo(p: Project): Promise<ChannelInfo[]> {
  return Promise.all(
    ADAPTERS.map(async (ad) => {
      const enabled = ad.configured();
      const info = enabled ? await ad.info(p.id) : { address: null, links: null, error: null };
      const l = p.channels?.[ad.kind];
      return {
        kind: ad.kind,
        label: CHANNEL_LABEL[ad.kind],
        enabled,
        address: info.address,
        links: info.links,
        linked: { contractor: Boolean(l?.contractor), client: Boolean(l?.client) },
        error: info.error ?? null,
        setup: ad.setup,
      };
    }),
  );
}

/** Push every not-yet-delivered message to each linked phone, on every configured app. */
export async function notifyChannels(projectId: string) {
  for (const ad of ADAPTERS) {
    if (!ad.configured()) continue;
    try {
      await deliver(ad, projectId);
    } catch (e) {
      console.error("[%s] deliver %s", ad.kind, (e as Error).message);
    }
  }
}

async function deliver(ad: Adapter, projectId: string) {
  const p = getProject(projectId);
  const link = p?.channels?.[ad.kind];
  if (!p || !link || (!link.contractor && !link.client)) return;
  const delivered = new Set(link.deliveredIds ?? []);
  const fresh = p.messages.filter((m) => !delivered.has(m.id));
  if (!fresh.length) return;
  // Mark before sending so overlapping notify calls never double-send.
  mutate(projectId, (pp) => {
    const l = pp.channels?.[ad.kind];
    if (l) l.deliveredIds = [...delivered, ...fresh.map((m) => m.id)].slice(-3000);
  });
  for (const m of fresh) {
    for (const role of ["contractor", "client"] as Role[]) {
      const to = link[role];
      if (!to) continue;
      const out = buildOutbound(p, m, role);
      if (!out) continue;
      await ad.send(to, out).catch((e) => console.error("[%s] send %s", ad.kind, (e as Error).message));
    }
  }
}

export function startChannels() {
  startTelegram();
  startIMessage();
  const on = ADAPTERS.filter((a) => a.configured()).map((a) => CHANNEL_LABEL[a.kind]);
  console.log(`[channels] ${on.length ? on.join(", ") : "none configured"}`);
}
