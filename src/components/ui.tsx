"use client";
import clsx from "clsx";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { money } from "@/lib/pricing";
import type { ChangeStatus } from "@/lib/types";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "agent" | "good" | "danger" | "dark"; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer whitespace-nowrap",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-[15px]",
        variant === "primary" && "bg-accent text-white shadow-[0_6px_20px_-6px_rgba(242,107,29,0.6)] hover:brightness-110",
        variant === "dark" && "bg-ink text-white hover:bg-black",
        variant === "agent" && "bg-gradient-to-r from-agent to-agent-2 text-white shadow-[0_6px_20px_-6px_rgba(107,92,255,0.6)] hover:brightness-110",
        variant === "good" && "bg-good text-white shadow-[0_6px_20px_-6px_rgba(16,185,129,0.6)] hover:brightness-110",
        variant === "danger" && "bg-white text-bad border border-bad/30 hover:bg-bad/5",
        variant === "outline" && "bg-white border border-line hover:border-ink/30",
        variant === "ghost" && "hover:bg-black/5 text-ink/80",
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-2xl border border-line bg-panel shadow-[0_1px_0_rgba(0,0,0,0.03),0_8px_24px_-12px_rgba(0,0,0,0.08)]", className)}>{children}</div>;
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
        "shrink-0 rounded-full grid place-items-center font-semibold text-white",
        tone === "ink" && "bg-ink",
        tone === "accent" && "bg-gradient-to-br from-accent to-accent-2",
        tone === "agent" && "bg-gradient-to-br from-agent to-agent-2",
        tone === "good" && "bg-good",
      )}
    >
      {initials}
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
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", m.cls, className)}>
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

export function Logo({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <div className="relative h-7 w-7 rounded-lg bg-gradient-to-br from-accent to-accent-2 grid place-items-center shadow-[0_4px_14px_-4px_rgba(242,107,29,0.7)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
        </svg>
      </div>
      <span>
        Snap<span className="text-accent">Contract</span>
      </span>
    </div>
  );
}
