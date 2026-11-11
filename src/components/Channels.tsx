"use client";

import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/lib/types";
import { formatPhone } from "@/lib/phone";
import type { Integrations } from "./useProject";

export type Surface = "web" | "telegram" | "whatsapp" | "imessage";

export const SURFACES: { id: Surface; label: string; tint: string }[] = [
  { id: "web", label: "Website", tint: "bg-ink" },
  { id: "telegram", label: "Telegram", tint: "bg-[#229ED9]" },
  { id: "whatsapp", label: "WhatsApp", tint: "bg-[#25D366]" },
  { id: "imessage", label: "iMessage", tint: "bg-[#0A84FF]" },
];

export function isSurface(value: string | null): value is Surface {
  return SURFACES.some((s) => s.id === value);
}

export function ChannelSwitcher({ value, onChange, live }: { value: Surface; onChange: (s: Surface) => void; live: Record<Surface, boolean> }) {
  return (
    <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-black/[0.045] p-1 scroll-thin">
      {SURFACES.map((s) => {
        const on = value === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={clsx(
              "relative flex items-center gap-2 rounded-full px-3 h-8 text-[12.5px] font-semibold cursor-pointer whitespace-nowrap transition-colors",
              on ? "bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-6px_rgba(0,0,0,0.18)]" : "text-muted hover:text-ink",
            )}
          >
            <span className={clsx("h-1.5 w-1.5 rounded-full", live[s.id] ? s.tint : "bg-black/15")} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

const SKIN = {
  telegram: {
    status: "text-white",
    header: "bg-[#517da2] text-white",
    sub: "text-white/75",
  },
  whatsapp: {
    status: "text-white",
    header: "bg-[#075e54] text-white",
    sub: "text-white/70",
  },
  imessage: {
    status: "text-black",
    header: "bg-[#f6f6f6] text-black border-b border-black/5",
    sub: "text-black/45",
  },
} as const;

export function PhoneFrame({
  surface,
  name,
  role,
  live,
  linkedAddress,
  otherLinked,
  telegram,
  onLink,
  children,
}: {
  surface: Exclude<Surface, "web">;
  name: string;
  role: Role;
  live: boolean;
  linkedAddress?: string;
  otherLinked: boolean;
  telegram?: Integrations["telegram"];
  onLink?: (address: string) => Promise<void>;
  children: ReactNode;
}) {
  const skin = SKIN[surface];
  const [clock, setClock] = useState("");
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const app = surface === "whatsapp" ? "WhatsApp" : surface === "imessage" ? "Messages" : "Telegram";

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);

  const save = async () => {
    if (!onLink) return;
    setBusy(true);
    setError(null);
    try {
      await onLink(phone);
      setPhone("");
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const botLink = role === "contractor" ? telegram?.links?.contractor : telegram?.links?.client;
  const botLinked = role === "contractor" ? telegram?.contractorLinked : telegram?.clientLinked;

  return (
    <div className="mx-auto flex h-full w-full max-w-[420px] min-h-0 flex-col px-3 py-3">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[34px] bg-black p-[9px] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.75)] ring-1 ring-white/15">
        <div className="pointer-events-none absolute left-1/2 top-[16px] z-30 h-[22px] w-[104px] -translate-x-1/2 rounded-full bg-black" />
        <div className={clsx("relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px]", surface === "imessage" ? "bg-white" : "bg-[#efeae2]")}>
          <div className={clsx("relative z-10 flex items-end justify-between px-5 pt-3 pb-1 text-[12px] font-semibold", skin.status, surface === "imessage" ? "bg-[#f6f6f6]" : surface === "whatsapp" ? "bg-[#075e54]" : "bg-[#517da2]")}>
            <span className="pt-1">{clock}</span>
            <span className="pt-1 flex items-center gap-1.5 text-[10px] tracking-wide">
              <span>5G</span>
              <span className="relative h-[10px] w-[18px] rounded-[2px] border border-current">
                <span className="absolute inset-[1.5px] right-[3px] rounded-[1px] bg-current" />
              </span>
            </span>
          </div>
          <header className={clsx("shrink-0 px-3.5 pb-2.5 pt-1 flex items-center gap-2.5", skin.header)}>
            <div className={clsx("h-8 w-8 rounded-full grid place-items-center text-[11px] font-bold", surface === "imessage" ? "bg-[#0A84FF] text-white" : "bg-white/15 text-white")}>
              {name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold leading-tight">{name}</div>
              <div className={clsx("truncate text-[11px]", skin.sub)}>
                {app} · {role}
                {live ? " · live" : " · demo stage"}
              </div>
            </div>
            <button onClick={() => setOpen((v) => !v)} className={clsx("h-7 px-2.5 rounded-full text-[11px] font-semibold cursor-pointer", surface === "imessage" ? "bg-black/5" : "bg-white/15")}>
              Connect
            </button>
          </header>
          {open && (
            <div className="shrink-0 border-b border-black/5 bg-white px-3 py-2.5 text-[12px] text-[#3c4043]">
              {surface === "telegram" ? (
                <div className="space-y-1.5">
                  <div>{botLinked ? "This side is linked to the bot." : "Open the bot and tap Start so texts land in this thread."} The other side is {telegram?.clientLinked && telegram?.contractorLinked ? "linked" : otherLinked ? "linked" : "not linked yet"}.</div>
                  {live && botLink ? (
                    <a href={botLink} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center rounded-full bg-[#229ED9] px-3 font-semibold text-white">
                      Open @{telegram?.username}
                    </a>
                  ) : (
                    <div className="text-muted">Add TELEGRAM_BOT_TOKEN to deliver this thread through a real bot. The phone below still runs the agent.</div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div>
                    {linkedAddress ? `Sending this side to ${formatPhone(linkedAddress)}.` : "Save the phone that should receive this side."} The other side is {otherLinked ? "linked" : "not linked yet"}.
                  </div>
                  <div className="text-[11.5px] text-muted">
                    {surface === "whatsapp"
                      ? live
                        ? "WhatsApp Cloud API is on. Approve and decline arrive as reply buttons."
                        : "Demo stage is on. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID, then point the webhook at /api/whatsapp."
                      : live
                        ? "Live texts go out through your iMessage sender. Reply APPROVE 2 or SEND 2."
                        : "Apple has no iMessage API. This stage still runs the agent. Set IMESSAGE_API_KEY to deliver through a LoopMessage-compatible sender. Webhook: /api/imessage."}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 415 555 0100"
                      className="h-8 flex-1 rounded-lg border border-black/10 px-2.5 text-[13px] outline-none focus:border-black/30"
                    />
                    <button onClick={save} disabled={busy || phone.trim().length < 8} className="h-8 px-3 rounded-lg bg-ink text-white text-[12px] font-semibold disabled:opacity-40 cursor-pointer">
                      Save
                    </button>
                  </div>
                  {error && <div className="text-bad">{error}</div>}
                </div>
              )}
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}
