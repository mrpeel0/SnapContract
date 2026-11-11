"use client";
import clsx from "clsx";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Columns2, FileSignature, GitPullRequestArrow, MessagesSquare, ReceiptText, RotateCcw, Ruler, Sparkles, Zap } from "lucide-react";
import type { Project, Role } from "@/lib/types";
import { budget } from "@/lib/pricing";
import { useProject, type Act, type Integrations } from "./useProject";
import { Chat } from "./Chat";
import { BudgetPanel } from "./BudgetPanel";
import { AgreementView } from "./AgreementView";
import { InvoiceView } from "./InvoiceView";
import { ChangeOrdersBoard } from "./ChangeOrdersBoard";
import { RateSheet } from "./RateSheet";
import { AnimatedMoney, Avatar, Logo } from "./ui";
import { ChannelSwitcher, isSurface, PhoneFrame, type Surface } from "./Channels";

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
  const initialChannel = params.get("channel");
  const [surface, setSurface] = useState<Surface>(isSurface(initialChannel) ? initialChannel : "web");

  useEffect(() => {
    const sp = new URLSearchParams({ tab, as: role, channel: surface });
    if (split) sp.set("split", "1");
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [tab, role, router, surface, split]);

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

  return (
    <div className="h-screen flex flex-col grain">
      {/* top bar */}
      <header className="no-print shrink-0 border-b border-line bg-white/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-4 px-5 h-14">
          <Link href="/" className="text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /></Link>
          <Logo className="text-[15px]" />
          <div className="h-6 w-px bg-line" />
          <div className="min-w-0">
            <div className="font-semibold text-[14px] truncate leading-tight">{project.name}</div>
            <div className="text-[11.5px] text-muted truncate leading-tight">{project.address}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-[12px] rounded-full border border-line bg-white px-3 py-1">
              <span className="text-muted">Contract</span>
              <AnimatedMoney value={b.current} cents={false} className="font-semibold" />
            </div>
            <div className="hidden xl:flex items-center gap-3 text-[11px] font-medium text-muted">
              <Live label="Telegram" on={Boolean(integrations?.telegram.enabled)} />
              <Live label="WhatsApp" on={Boolean(integrations?.whatsapp?.enabled)} />
              <Live label="iMessage" on={Boolean(integrations?.imessage?.enabled)} />
              <Live label={integrations?.ramp.enabled ? (integrations.ramp.sandbox ? "Ramp sandbox" : "Ramp") : "Ramp"} on={Boolean(integrations?.ramp.enabled)} />
            </div>
            <span
              title={ai === "claude" ? "Using Claude for change detection and drafting" : ai === "local" ? "Using a local model through Ollama" : "No ANTHROPIC_API_KEY or LOCAL_MODEL set: using the built-in offline engine"}
              className={clsx("hidden md:inline-flex items-center gap-1 text-[11.5px] font-semibold rounded-full px-2.5 py-1", ai ? "bg-agent/10 text-agent" : "bg-black/5 text-muted")}
            >
              {ai ? <Sparkles className="h-3 w-3" /> : <Zap className="h-3 w-3" />} {ai === "claude" ? "Claude live" : ai === "local" ? "Local model" : "Offline engine"}
            </span>
            <button
              onClick={() => setSplit((s) => !s)}
              className={clsx("hidden md:inline-flex items-center gap-1.5 text-[12.5px] font-medium rounded-xl px-3 h-9 border cursor-pointer transition-colors", split ? "bg-ink text-white border-ink" : "bg-white border-line hover:border-ink/30")}
            >
              <Columns2 className="h-4 w-4" /> Split view
            </button>
            {!split && (
              <div className="relative flex rounded-xl bg-black/[0.05] p-1">
                {(["contractor", "client"] as Role[]).map((r) => {
                  const party = r === "contractor" ? project.contractor : project.client;
                  const n = pendingFor(r);
                  return (
                    <button key={r} onClick={() => setRole(r)} className="relative z-10 flex items-center gap-2 px-2.5 h-8 rounded-lg text-[12.5px] font-medium cursor-pointer">
                      {role === r && <motion.span layoutId="role" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                      <span className="relative flex items-center gap-1.5">
                        <Avatar name={party.name} tone={r === "contractor" ? "ink" : "accent"} size={20} />
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
              className="h-9 w-9 grid place-items-center rounded-xl hover:bg-black/5 text-muted cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
        {!split && (
          <nav className="flex gap-1 px-4">
            {TABS.map((t) => {
              const Icon = t.icon;
              const badge = t.key === "changes" ? pendingFor(role) : t.key === "agreement" && agreementNeedsMe ? 1 : 0;
              return (
                <button key={t.key} onClick={() => setTab(t.key)} className={clsx("relative flex items-center gap-1.5 px-3 h-10 text-[13px] font-medium cursor-pointer transition-colors", tab === t.key ? "text-ink" : "text-muted hover:text-ink")}>
                  <Icon className="h-4 w-4" /> {t.label}
                  {badge > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  {tab === t.key && <motion.span layoutId="tab" className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-accent" />}
                </button>
              );
            })}
          </nav>
        )}
        <div className="flex items-center gap-3 border-t border-line/80 px-4 py-2 bg-white/70">
          <ChannelSwitcher
            value={surface}
            onChange={(next) => {
              setSurface(next);
              if (next !== "web") setTab("chat");
            }}
            live={{
              web: true,
              telegram: Boolean(integrations?.telegram.enabled),
              whatsapp: Boolean(integrations?.whatsapp?.enabled),
              imessage: Boolean(integrations?.imessage?.enabled),
            }}
          />
          <span className="ml-auto hidden lg:block text-[11.5px] text-muted">Same thread on every app. A colored dot means live delivery is connected.</span>
        </div>
      </header>

      {split ? (
        <div className={clsx("flex-1 min-h-0 grid grid-cols-[1fr_1fr_340px]", surface === "web" ? "bg-transparent" : "bg-[#0e1116]")}>
          {(["contractor", "client"] as Role[]).map((r) => {
            const party = r === "contractor" ? project.contractor : project.client;
            return (
              <div key={r} className={clsx("min-h-0 flex flex-col", surface === "web" && "border-r border-line")}>
                {surface === "web" && (
                  <div className={clsx("shrink-0 px-4 py-2.5 flex items-center gap-2 text-[13px] border-b border-line", r === "contractor" ? "bg-ink text-white" : "bg-gradient-to-r from-accent to-accent-2 text-white")}>
                    <Avatar name={party.name} tone={r === "contractor" ? "ink" : "accent"} size={24} />
                    <span className="font-semibold">{party.name}</span>
                    <span className="opacity-70 capitalize">· {r}</span>
                  </div>
                )}
                <Thread project={project} role={r} act={act} surface={surface} integrations={integrations} ramp={integrations?.ramp.enabled} />
              </div>
            );
          })}
          <div className={clsx("min-h-0 overflow-y-auto scroll-thin p-4", surface !== "web" && "bg-[#f6f4ef]")}>
            <BudgetPanel project={project} role="contractor" />
          </div>
        </div>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto scroll-thin">
          {tab === "chat" && (
            <div className={clsx("h-full grid lg:grid-cols-[1fr_360px] gap-0", surface !== "web" && "bg-[#0e1116]")}>
              <Thread project={project} role={role} act={act} surface={surface} integrations={integrations} ramp={integrations?.ramp.enabled} className={surface === "web" ? "border-r border-line" : ""} />
              <div className={clsx("hidden lg:block overflow-y-auto scroll-thin p-5", surface !== "web" && "bg-[#f6f4ef]")}>
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
    </div>
  );
}

function Live({ label, on }: { label: string; on: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx("h-1.5 w-1.5 rounded-full", on ? "bg-good" : "bg-black/20")} />
      {label}
    </span>
  );
}

function Thread({
  project,
  role,
  act,
  surface,
  integrations,
  ramp,
  className,
}: {
  project: Project;
  role: Role;
  act: Act;
  surface: Surface;
  integrations: Integrations | null;
  ramp?: boolean;
  className?: string;
}) {
  const party = role === "contractor" ? project.contractor : project.client;
  const chat = <Chat project={project} role={role} act={act} className="flex-1 min-h-0" dense={surface !== "web"} ramp={ramp} skin={surface} />;
  if (surface === "web") return <div className={clsx("min-h-0 flex flex-col h-full", className)}>{chat}</div>;
  const phone = surface === "whatsapp" ? integrations?.whatsapp : surface === "imessage" ? integrations?.imessage : undefined;
  return (
    <div className={clsx("min-h-0 h-full", className)}>
      <PhoneFrame
        surface={surface}
        name={party.name}
        role={role}
        live={surface === "telegram" ? Boolean(integrations?.telegram.enabled) : Boolean(phone?.enabled)}
        linkedAddress={role === "contractor" ? phone?.contractorAddress : phone?.clientAddress}
        otherLinked={surface === "telegram" ? Boolean(role === "contractor" ? integrations?.telegram.clientLinked : integrations?.telegram.contractorLinked) : Boolean(role === "contractor" ? phone?.clientLinked : phone?.contractorLinked)}
        telegram={integrations?.telegram}
        onLink={
          surface === "telegram"
            ? undefined
            : async (address) => {
                await act({ type: "linkChannel", channel: surface, role, address });
              }
        }
      >
        {chat}
      </PhoneFrame>
    </div>
  );
}
