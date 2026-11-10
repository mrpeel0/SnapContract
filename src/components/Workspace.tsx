"use client";
import clsx from "clsx";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Columns2, FileSignature, GitPullRequestArrow, MessagesSquare, ReceiptText, RotateCcw, Ruler, Sparkles, Zap } from "lucide-react";
import type { Role } from "@/lib/types";
import { budget } from "@/lib/pricing";
import { useProject } from "./useProject";
import { Chat } from "./Chat";
import { BudgetPanel } from "./BudgetPanel";
import { AgreementView } from "./AgreementView";
import { InvoiceView } from "./InvoiceView";
import { ChangeOrdersBoard } from "./ChangeOrdersBoard";
import { RateSheet } from "./RateSheet";
import { AnimatedMoney, Avatar, Logo } from "./ui";

const TABS = [
  { key: "chat", label: "Conversation", icon: MessagesSquare },
  { key: "agreement", label: "Agreement", icon: FileSignature },
  { key: "changes", label: "Change orders", icon: GitPullRequestArrow },
  { key: "invoice", label: "Invoice", icon: ReceiptText },
  { key: "rates", label: "Rate sheet", icon: Ruler },
];

export function Workspace({ id }: { id: string }) {
  const { project, ai, act, error } = useProject(id);
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState(params.get("tab") ?? "chat");
  const [role, setRole] = useState<Role>((params.get("as") as Role) ?? "contractor");
  const [split, setSplit] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams({ tab, as: role });
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [tab, role, router]);

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
      </header>

      {split ? (
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_1fr_340px]">
          {(["contractor", "client"] as Role[]).map((r) => {
            const party = r === "contractor" ? project.contractor : project.client;
            return (
              <div key={r} className="min-h-0 flex flex-col border-r border-line">
                <div className={clsx("shrink-0 px-4 py-2.5 flex items-center gap-2 text-[13px] border-b border-line", r === "contractor" ? "bg-ink text-white" : "bg-gradient-to-r from-accent to-accent-2 text-white")}>
                  <Avatar name={party.name} tone={r === "contractor" ? "ink" : "accent"} size={24} />
                  <span className="font-semibold">{party.name}</span>
                  <span className="opacity-70 capitalize">· {r}&apos;s phone</span>
                </div>
                <Chat project={project} role={r} act={act} className="flex-1" dense />
              </div>
            );
          })}
          <div className="min-h-0 overflow-y-auto scroll-thin p-4">
            <BudgetPanel project={project} role="contractor" />
          </div>
        </div>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto scroll-thin">
          {tab === "chat" && (
            <div className="h-full grid lg:grid-cols-[1fr_360px] gap-0">
              <Chat project={project} role={role} act={act} className="min-h-0 border-r border-line" />
              <div className="hidden lg:block overflow-y-auto scroll-thin p-5">
                <BudgetPanel project={project} role={role} onOpen={setTab} />
              </div>
            </div>
          )}
          <div className="px-5">
            {tab === "agreement" && <AgreementView project={project} role={role} act={act} />}
            {tab === "changes" && <ChangeOrdersBoard project={project} role={role} act={act} />}
            {tab === "invoice" && <InvoiceView project={project} />}
            {tab === "rates" && <RateSheet project={project} role={role} act={act} />}
          </div>
        </main>
      )}
    </div>
  );
}
