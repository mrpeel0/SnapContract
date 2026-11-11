"use client";
import clsx from "clsx";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Columns2, FileSignature, GitPullRequestArrow, MessagesSquare, ReceiptText, RotateCcw, Ruler } from "lucide-react";
import type { Role } from "@/lib/types";
import { budget, money } from "@/lib/pricing";
import { useProject } from "./useProject";
import { Chat } from "./Chat";
import { BudgetPanel } from "./BudgetPanel";
import { AgreementView } from "./AgreementView";
import { InvoiceView } from "./InvoiceView";
import { ChangeOrdersBoard } from "./ChangeOrdersBoard";
import { RateSheet } from "./RateSheet";
import { AnimatedMoney, Avatar, ChannelIcon, Dot, Logo } from "./ui";
import { ConnectModal } from "./Channels";

const TABS = [
  { key: "chat", label: "Conversation", icon: MessagesSquare },
  { key: "agreement", label: "Agreement", icon: FileSignature },
  { key: "changes", label: "Change orders", icon: GitPullRequestArrow },
  { key: "invoice", label: "Invoice", icon: ReceiptText },
  { key: "rates", label: "Rate sheet", icon: Ruler },
];

export function Workspace({ id }: { id: string }) {
  const { project, ai, integrations, act, error } = useProject(id);
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState(params.get("tab") ?? "chat");
  const [role, setRole] = useState<Role>((params.get("as") as Role) ?? "contractor");
  const [split, setSplit] = useState(params.get("split") === "1");
  const [connectOpen, setConnectOpen] = useState(params.get("connect") === "1");
  const [connectRole, setConnectRole] = useState<Role>("client");

  useEffect(() => {
    const sp = new URLSearchParams({ tab, as: role, ...(split ? { split: "1" } : {}) });
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [tab, role, split, router]);

  if (error && !project) return <div className="p-10 text-center text-muted">{error}</div>;
  if (!project) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="dot-pulse flex gap-1.5"><span /><span /><span /></div>
      </div>
    );
  }

  const b = budget(project);
  const pendingFor = (r: Role) =>
    project.changeOrders.filter((c) => (r === "contractor" ? ["needs_info", "contractor_review"].includes(c.status) : c.status === "client_review")).length;
  const agreementNeedsMe = project.agreement.status === "draft" && !project.agreement.signatures[role];

  const channels = integrations?.channels ?? [];
  const enabledChannels = channels.filter((c) => c.enabled);
  const linkedCount = channels.reduce((n, c) => n + Number(c.linked.contractor) + Number(c.linked.client), 0);
  const aiLabel = ai === "openai" ? "OpenAI" : ai === "claude" ? "Claude" : ai === "local" ? "Local model" : "Offline engine";
  const openConnect = (r: Role) => {
    setConnectRole(r);
    setConnectOpen(true);
  };

  return (
    <div className="h-screen flex flex-col grain">
      <header className="no-print shrink-0 border-b border-line bg-white/85 backdrop-blur-md z-30">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link href="/" className="h-8 w-8 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-sunken" title="All projects"><ArrowLeft className="h-4 w-4" /></Link>
          <Logo className="text-[14.5px] hidden sm:flex" />
          <ChevronRight className="h-4 w-4 text-line-strong hidden sm:block" />
          <div className="min-w-0">
            <div className="font-semibold text-[14px] truncate leading-tight">{project.name}</div>
            <div className="text-[11.5px] text-muted truncate leading-tight">{project.address} · {project.client.name}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden xl:flex items-center gap-1.5 text-[12px] rounded-lg border border-line bg-white px-2.5 h-8">
              <span className="text-muted">Contract</span>
              <AnimatedMoney value={b.current} cents={false} className="font-semibold" />
              {b.pending !== 0 && <span className="text-accent font-medium tabular-nums">· {money(b.pending, { sign: true, cents: false })} open</span>}
            </div>
            <div className="hidden lg:flex items-center h-8 rounded-lg border border-line bg-white text-[12px] font-medium divide-x divide-line">
              <span className="flex items-center gap-1.5 px-2.5" title={ai ? `${aiLabel} detects changes and drafts agreements` : "No model key set: using the built-in offline engine"}>
                <Dot tone={ai ? "agent" : "muted"} pulse={project.agentStatus === "thinking"} /> {aiLabel}
              </span>
              <span className="flex items-center gap-1.5 px-2.5" title={integrations?.ramp.enabled ? "Approved materials get a Ramp virtual card" : "Set RAMP_CLIENT_ID and RAMP_CLIENT_SECRET to issue real cards"}>
                <Dot tone={integrations?.ramp.enabled ? "good" : "muted"} /> Ramp{integrations?.ramp.enabled && integrations.ramp.sandbox ? " sandbox" : integrations?.ramp.enabled ? "" : " off"}
              </span>
            </div>
            <button onClick={() => openConnect(role)} className="inline-flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-lg border border-line bg-white text-[12.5px] font-medium hover:bg-sunken cursor-pointer" title="Connect WhatsApp, iMessage or Telegram">
              <span className="flex -space-x-1">
                {(enabledChannels.length ? enabledChannels : channels).map((c) => (
                  <ChannelIcon key={c.kind} kind={c.kind} size={20} className={clsx("ring-2 ring-white", !c.enabled && "opacity-35 grayscale")} />
                ))}
              </span>
              <span className="hidden sm:inline">Phones</span>
              {linkedCount > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-good text-white text-[10px] font-bold grid place-items-center">{linkedCount}</span>}
            </button>
            <button
              onClick={() => setSplit((s) => !s)}
              className={clsx("hidden md:inline-flex items-center gap-1.5 text-[12.5px] font-medium rounded-lg px-2.5 h-8 border cursor-pointer transition-colors", split ? "bg-ink text-white border-ink" : "bg-white border-line hover:bg-sunken")}
            >
              <Columns2 className="h-4 w-4" /> Split view
            </button>
            {!split && (
              <div className="relative flex rounded-lg bg-sunken p-0.5 ring-1 ring-line">
                {(["contractor", "client"] as Role[]).map((r) => {
                  const party = r === "contractor" ? project.contractor : project.client;
                  const n = pendingFor(r);
                  return (
                    <button key={r} onClick={() => setRole(r)} className="relative z-10 flex items-center gap-2 px-2.5 h-7 rounded-md text-[12.5px] font-medium cursor-pointer">
                      {role === r && <motion.span layoutId="role" className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-black/5" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                      <span className="relative flex items-center gap-1.5">
                        <Avatar name={party.name} tone={r === "contractor" ? "ink" : "accent"} size={18} />
                        <span className="capitalize">{r}</span>
                        {n > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold grid place-items-center">{n}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              title="Reset demo data"
              onClick={async () => {
                if (!confirm("Reset all demo data?")) return;
                await fetch("/api/reset", { method: "POST" });
                location.href = "/projects/maple-kitchen";
              }}
              className="h-8 w-8 grid place-items-center rounded-lg hover:bg-sunken text-muted cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
        {!split && (
          <nav className="flex gap-0.5 px-3 overflow-x-auto no-scrollbar">
            {TABS.map((t) => {
              const Icon = t.icon;
              const badge = t.key === "changes" ? pendingFor(role) : t.key === "agreement" && agreementNeedsMe ? 1 : 0;
              return (
                <button key={t.key} onClick={() => setTab(t.key)} className={clsx("relative flex items-center gap-1.5 px-3 h-10 text-[13px] font-medium cursor-pointer transition-colors shrink-0", tab === t.key ? "text-ink" : "text-muted hover:text-ink")}>
                  <Icon className="h-4 w-4" /> {t.label}
                  {badge > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-accent/12 text-accent text-[10px] font-bold grid place-items-center">{badge}</span>}
                  {tab === t.key && <motion.span layoutId="tab" className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-ink" />}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {split ? (
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_1fr_340px]">
          {(["contractor", "client"] as Role[]).map((r) => {
            const party = r === "contractor" ? project.contractor : project.client;
            return (
              <div key={r} className="min-h-0 flex flex-col border-r border-line">
                <div className="shrink-0 px-4 h-12 flex items-center gap-2.5 text-[13px] border-b border-line bg-white">
                  <Avatar name={party.name} tone={r === "contractor" ? "ink" : "accent"} size={26} />
                  <div className="min-w-0 leading-tight">
                    <div className="font-semibold truncate">{party.name}</div>
                    <div className="text-[11px] text-muted capitalize">{r}{r === "contractor" && project.contractor.company ? ` · ${project.contractor.company}` : ""}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    {channels.filter((c) => c.linked[r]).map((c) => (
                      <span key={c.kind} title={`Linked on ${c.label}`} className="inline-flex items-center gap-1 rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium">
                        <ChannelIcon kind={c.kind} size={14} /> {c.label}
                      </span>
                    ))}
                    {pendingFor(r) > 0 && <span className="rounded-md bg-accent/10 text-accent px-1.5 py-0.5 text-[11px] font-semibold">{pendingFor(r)} to review</span>}
                  </div>
                </div>
                <Chat project={project} role={r} act={act} className="flex-1" dense channels={channels} onConnect={() => openConnect(r)} ramp={integrations?.ramp.enabled} />
              </div>
            );
          })}
          <div className="min-h-0 overflow-y-auto scroll-thin p-4 bg-bg">
            <BudgetPanel project={project} role="contractor" />
          </div>
        </div>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto scroll-thin">
          {tab === "chat" && (
            <div className="h-full grid lg:grid-cols-[1fr_360px] gap-0">
              <Chat project={project} role={role} act={act} className="min-h-0 border-r border-line" channels={channels} onConnect={() => openConnect(role)} ramp={integrations?.ramp.enabled} />
              <div className="hidden lg:block overflow-y-auto scroll-thin p-5">
                <BudgetPanel project={project} role={role} onOpen={setTab} />
              </div>
            </div>
          )}
          <div className="px-5">
            {tab === "agreement" && <AgreementView project={project} role={role} act={act} />}
            {tab === "changes" && <ChangeOrdersBoard project={project} role={role} act={act} ramp={integrations?.ramp.enabled} />}
            {tab === "invoice" && <InvoiceView project={project} role={role} act={act} ramp={integrations?.ramp.enabled} />}
            {tab === "rates" && <RateSheet project={project} role={role} act={act} />}
          </div>
        </main>
      )}
      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} project={project} channels={channels} initialRole={connectRole} />
    </div>
  );
}
