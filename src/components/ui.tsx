"use client";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { money } from "@/lib/pricing";
import type { ChangeStatus, ChannelKind } from "@/lib/types";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "accent" | "ghost" | "outline" | "agent" | "good" | "danger" | "dark"; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[background,box-shadow,transform,border-color] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agent/40 focus-visible:ring-offset-1",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-9 px-3.5 text-[13.5px]",
        size === "lg" && "h-11 px-5 text-[14.5px]",
        (variant === "primary" || variant === "dark") && "bg-ink text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-ink-2",
        variant === "accent" && "bg-accent text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-accent-2",
        variant === "agent" && "bg-agent text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-agent-2",
        variant === "good" && "bg-good text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] hover:brightness-105",
        variant === "danger" && "bg-white text-bad border border-bad/25 hover:bg-bad/5",
        variant === "outline" && "bg-white border border-line text-ink shadow-[0_1px_1px_rgba(0,0,0,0.03)] hover:bg-sunken hover:border-line-strong",
        variant === "ghost" && "text-ink/75 hover:bg-black/[0.05] hover:text-ink",
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-xl border border-line bg-panel shadow-[0_1px_2px_rgba(15,16,18,0.04)]", className)}>{children}</div>;
}

export function Avatar({ name, tone = "ink", size = 32 }: { name: string; tone?: "ink" | "accent" | "agent" | "good"; size?: number }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={clsx(
        "shrink-0 rounded-full grid place-items-center font-semibold text-white ring-2 ring-white",
        tone === "ink" && "bg-ink",
        tone === "accent" && "bg-accent",
        tone === "agent" && "bg-agent",
        tone === "good" && "bg-good",
      )}
    >
      {tone === "agent" ? <Sparkles style={{ width: size * 0.5, height: size * 0.5 }} /> : initials}
    </div>
  );
}

export const STATUS_META: Record<ChangeStatus, { label: string; cls: string; dot: string }> = {
  needs_info: { label: "Needs details", cls: "bg-warn/12 text-[#a35f00]", dot: "bg-warn" },
  contractor_review: { label: "Contractor review", cls: "bg-agent/10 text-agent", dot: "bg-agent" },
  client_review: { label: "Awaiting client", cls: "bg-accent/10 text-accent", dot: "bg-accent" },
  approved: { label: "Approved", cls: "bg-good/12 text-[#067a55]", dot: "bg-good" },
  declined: { label: "Declined", cls: "bg-bad/10 text-bad", dot: "bg-bad" },
  void: { label: "Dismissed", cls: "bg-black/5 text-muted", dot: "bg-muted" },
};

export function StatusPill({ status, className }: { status: ChangeStatus; className?: string }) {
  const m = STATUS_META[status];
  const live = ["needs_info", "contractor_review", "client_review"].includes(status);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold", m.cls, className)}>
      <span className="relative flex h-1.5 w-1.5">
        {live && <span className={clsx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", m.dot)} />}
        <span className={clsx("relative inline-flex h-1.5 w-1.5 rounded-full", m.dot)} />
      </span>
      {m.label}
    </span>
  );
}

export function useAnimatedNumber(value: number, ms = 700) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setDisplay(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return display;
}

export function AnimatedMoney({ value, className, sign, cents = true }: { value: number; className?: string; sign?: boolean; cents?: boolean }) {
  const v = useAnimatedNumber(value);
  return <span className={clsx("tabular-nums", className)}>{money(v, { sign, cents })}</span>;
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function Logo({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <div className={clsx("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <div className={clsx("relative h-7 w-7 rounded-lg grid place-items-center", dark ? "bg-white" : "bg-ink")}>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="currentColor">
          <path d="M13.2 2.4 4.8 13.2c-.4.5 0 1.2.6 1.2H11l-1 6.9c-.1.8.9 1.2 1.4.6l8.4-10.8c.4-.5 0-1.2-.6-1.2H13.6l1-6.9c.1-.8-.9-1.2-1.4-.6Z" />
        </svg>
      </div>
      <span>SnapContract</span>
    </div>
  );
}

export function Dot({ tone, pulse }: { tone: "good" | "warn" | "bad" | "muted" | "agent"; pulse?: boolean }) {
  const c = { good: "bg-good", warn: "bg-warn", bad: "bg-bad", muted: "bg-black/25", agent: "bg-agent" }[tone];
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
      {pulse && <span className={clsx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", c)} />}
      <span className={clsx("relative inline-flex h-1.5 w-1.5 rounded-full", c)} />
    </span>
  );
}

export type ChannelKey = ChannelKind | "web";

export const CHANNEL_META: Record<ChannelKey, { label: string; bg: string; text: string }> = {
  whatsapp: { label: "WhatsApp", bg: "bg-whatsapp", text: "text-whatsapp" },
  imessage: { label: "iMessage", bg: "bg-imessage", text: "text-imessage" },
  telegram: { label: "Telegram", bg: "bg-telegram", text: "text-telegram" },
  web: { label: "Web", bg: "bg-ink", text: "text-ink" },
};

/** Simple glyphs in each app's color. */
export function ChannelIcon({ kind, size = 28, className }: { kind: ChannelKey; size?: number; className?: string }) {
  const s = size * 0.56;
  return (
    <span style={{ width: size, height: size }} className={clsx("shrink-0 grid place-items-center text-white", size >= 24 ? "rounded-[9px]" : "rounded-md", CHANNEL_META[kind].bg, className)}>
      {kind === "telegram" && (
        <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M20.7 4.1 2.9 11c-1.1.4-1.1 1.9 0 2.2l4.4 1.4 1.7 5.3c.3.9 1.4 1.1 2 .5l2.5-2.4 4.6 3.4c.7.5 1.7.1 1.9-.8L23 5.6c.2-1.1-.9-1.9-2.3-1.5ZM9.4 14.6l8.3-7.4c.3-.3-.1-.6-.4-.4L7.9 13.3l.8 4.2.7-2.9Z" /></svg>
      )}
      {kind === "whatsapp" && (
        <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.3 4.8 4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.3 1 2.5.1.2 1.7 2.6 4.1 3.6 1.5.7 2.1.7 2.9.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.3-.4Z" /></svg>
      )}
      {kind === "imessage" && (
        <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M12 3C6.5 3 2 6.8 2 11.4c0 2.6 1.4 4.9 3.7 6.4-.2 1.3-.9 2.5-1.8 3.3 2 .1 3.8-.6 5.1-1.6.9.2 2 .3 3 .3 5.5 0 10-3.8 10-8.4S17.5 3 12 3Z" /></svg>
      )}
      {kind === "web" && <Globe style={{ width: s, height: s }} />}
    </span>
  );
}

export function Modal({ open, onClose, children, className }: { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-[#0b0c0e]/45 backdrop-blur-[2px] grid place-items-center p-4" onClick={onClose}>
          <motion.div
            initial={{ scale: 0.97, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className={clsx("w-full max-h-[90vh] overflow-y-auto scroll-thin rounded-2xl bg-white shadow-[0_24px_80px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5", className)}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
