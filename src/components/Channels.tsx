"use client";
import clsx from "clsx";
import QRCode from "qrcode";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, Smartphone, X } from "lucide-react";
import type { Project, Role } from "@/lib/types";
import type { ChannelInfo } from "./useProject";
import { Avatar, ChannelIcon, Dot, Modal } from "./ui";

export function QR({ value, size = 148 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: "#0f1012", light: "#ffffff" }, errorCorrectionLevel: "M" }).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [value, size]);
  return (
    <div style={{ width: size, height: size }} className="rounded-lg bg-white p-1.5 ring-1 ring-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="Scan to connect" className="h-full w-full [image-rendering:pixelated]" /> : <div className="h-full w-full shimmer rounded" />}
    </div>
  );
}

const openLabel: Record<ChannelInfo["kind"], string> = { whatsapp: "Open WhatsApp", imessage: "Open Messages", telegram: "Open Telegram" };

function ChannelCard({ c, role, project }: { c: ChannelInfo; role: Role; project: Project }) {
  const [copied, setCopied] = useState(false);
  const link = c.links?.[role];
  const linked = c.linked[role];
  const party = role === "contractor" ? project.contractor : project.client;

  if (!c.enabled) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-sunken/60 p-4">
        <div className="flex items-center gap-2.5">
          <ChannelIcon kind={c.kind} size={28} className="opacity-50 grayscale" />
          <div className="min-w-0">
            <div className="font-semibold text-[14px]">{c.label}</div>
            <div className="text-[12px] text-muted">Not connected on this server</div>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          {c.setup.map((s) => (
            <div key={s} className="font-mono text-[11px] text-ink/70 bg-white rounded-md border border-line px-2 py-1 break-all">{s}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx("rounded-xl border bg-white p-4 transition-colors", linked ? "border-good/40 ring-1 ring-good/15" : "border-line")}>
      <div className="flex items-center gap-2.5">
        <ChannelIcon kind={c.kind} size={28} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[14px]">{c.label}</div>
          <div className="text-[12px] text-muted truncate">{c.address ?? "—"}</div>
        </div>
        {linked ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-good/10 px-2 py-0.5 text-[11.5px] font-semibold text-good">
            <Check className="h-3 w-3" /> Linked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-sunken px-2 py-0.5 text-[11.5px] font-medium text-muted">
            <Dot tone="muted" /> Waiting
          </span>
        )}
      </div>

      {c.error && (
        <div className="mt-3 flex gap-1.5 rounded-lg bg-warn/10 px-2.5 py-2 text-[12px] text-[#8a5a00]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {c.error}
        </div>
      )}

      {link && (
        <div className="mt-3 flex gap-3.5 items-center">
          <QR value={link} size={112} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-[12.5px] text-ink/80 leading-snug">
              Scan with {party.name.split(" ")[0]}&apos;s phone{c.kind === "telegram" ? ", then tap Start." : ", then hit send."}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-ink text-white text-[12px] font-medium hover:bg-ink-2">
                {openLabel[c.kind]} <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                }}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-line text-[12px] font-medium hover:bg-sunken cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConnectModal({ open, onClose, project, channels, initialRole = "client" }: { open: boolean; onClose: () => void; project: Project; channels: ChannelInfo[]; initialRole?: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setRole(initialRole);
  }, [open, initialRole]);
  const sorted = [...channels].sort((a, b) => Number(b.enabled) - Number(a.enabled));
  return (
    <Modal open={open} onClose={onClose} className="max-w-3xl">
      <div className="px-6 pt-5 pb-4 border-b border-line flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-sunken grid place-items-center"><Smartphone className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold tracking-tight">Run this project from a phone</div>
          <div className="text-[13px] text-muted mt-0.5">Each side texts from the app they already use. The agent prices changes in the thread and approvals happen with one tap.</div>
        </div>
        <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg text-muted hover:bg-sunken cursor-pointer"><X className="h-4 w-4" /></button>
      </div>
      <div className="px-6 pt-4">
        <div className="inline-flex rounded-lg bg-sunken p-1">
          {(["client", "contractor"] as Role[]).map((r) => {
            const party = r === "contractor" ? project.contractor : project.client;
            const n = channels.filter((c) => c.linked[r]).length;
            return (
              <button key={r} onClick={() => setRole(r)} className="relative flex items-center gap-2 h-8 px-3 rounded-md text-[13px] font-medium cursor-pointer">
                {role === r && <motion.span layoutId="connect-role" className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-black/5" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                <span className="relative flex items-center gap-2">
                  <Avatar name={party.name} tone={r === "contractor" ? "ink" : "accent"} size={20} />
                  {party.name} <span className="text-muted font-normal capitalize">· {r}</span>
                  {n > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-good text-white text-[10px] font-bold grid place-items-center">{n}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-6 pt-4 grid sm:grid-cols-2 gap-3">
        {sorted.map((c) => (
          <ChannelCard key={c.kind} c={c} role={role} project={project} />
        ))}
        <div className="rounded-xl border border-line bg-white p-4 flex items-center gap-2.5">
          <ChannelIcon kind="web" size={28} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[14px]">Web</div>
            <div className="text-[12px] text-muted">This workspace · always on</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-good/10 px-2 py-0.5 text-[11.5px] font-semibold text-good"><Check className="h-3 w-3" /> Live</span>
        </div>
      </div>
      <div className="px-6 pb-5 -mt-1 text-[12px] text-muted">One phone follows one project per app. Scanning a different project&apos;s code moves it there. Commands: <span className="font-mono text-ink/70">approve 2</span>, <span className="font-mono text-ink/70">decline 2</span>, <span className="font-mono text-ink/70">send 2</span>, <span className="font-mono text-ink/70">status</span>.</div>
    </Modal>
  );
}

/** Compact "where this conversation lives" row for a single side. */
export function ChannelStrip({ channels, role, onConnect, dense }: { channels: ChannelInfo[]; role: Role; onConnect: () => void; dense?: boolean }) {
  const enabled = channels.filter((c) => c.enabled);
  const linked = enabled.filter((c) => c.linked[role]);
  return (
    <div className="flex items-center gap-2 text-[12px]">
      {enabled.length === 0 ? (
        <span className="text-muted">Web only · add WhatsApp, iMessage or Telegram so each side can text from their phone</span>
      ) : (
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-muted shrink-0">{linked.length ? "Synced to" : "Available on"}</span>
        <div className="flex items-center gap-1">
          {(linked.length ? linked : enabled).map((c) => (
            <span key={c.kind} title={`${c.label}${c.linked[role] ? " · linked" : " · not linked"}`} className="relative">
              <ChannelIcon kind={c.kind} size={18} className={clsx(!c.linked[role] && "opacity-35 grayscale")} />
              {c.linked[role] && <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-good ring-2 ring-white" />}
            </span>
          ))}
        </div>
        {linked.length > 0 && !dense && <span className="text-ink/70 truncate">{linked.map((c) => c.label).join(", ")}</span>}
      </div>
      )}
      <button onClick={onConnect} className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-md px-2 h-6 font-medium text-ink/80 hover:bg-sunken cursor-pointer">
        <Smartphone className="h-3.5 w-3.5" /> {linked.length ? "Phones" : enabled.length ? "Connect phone" : "Set up"}
      </button>
    </div>
  );
}
