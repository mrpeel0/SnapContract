"use client";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, Sparkles, Upload, Wand2 } from "lucide-react";
import { Button, Card, Logo } from "@/components/ui";
import { parseCsv } from "@/components/RateSheet";
import { SAMPLE_PRICE_SHEET } from "@/lib/seed";
import type { PriceItem } from "@/lib/types";

const SAMPLE = {
  name: "Elm Ave Primary Bath",
  address: "88 Elm Ave, West Hartford, CT",
  contractorName: "Marcus Reyes",
  company: "Reyes Build Co.",
  clientName: "Jordan Lee",
  description:
    "Primary bathroom refresh, about 90 sq ft. Remove the old floor and install porcelain floor tile. Install 4 recessed lights and 2 GFCI outlets by the vanity. Repaint walls and ceiling. New faucet. Target 3 weeks.",
};

export default function NewProject() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", address: "", contractorName: "", company: "", clientName: "", description: "" });
  const [sheet, setSheet] = useState<PriceItem[]>(SAMPLE_PRICE_SHEET);
  const [sheetSource, setSheetSource] = useState("Sample remodel rate sheet");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const valid = form.name && form.contractorName && form.clientName && form.description.length > 20;

  const create = async () => {
    setBusy(true);
    const r = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, priceSheet: sheet }) });
    const { project } = await r.json();
    await fetch(`/api/projects/${project.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "draftAgreement" }) });
    router.push(`/projects/${project.id}?tab=agreement&as=contractor`);
  };

  return (
    <div className="min-h-screen grain">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-muted hover:text-ink flex items-center gap-1 text-sm"><ArrowLeft className="h-4 w-4" /> Back</Link>
          <Logo />
        </div>

        <div className="mt-10 flex items-center gap-3">
          {["Project", "Rate sheet", "Draft"].map((s, i) => (
            <div key={s} className="flex items-center gap-3 flex-1">
              <div className={clsx("h-8 w-8 rounded-full grid place-items-center text-sm font-semibold transition-colors", i < step ? "bg-good text-white" : i === step ? "bg-ink text-white" : "bg-black/5 text-muted")}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={clsx("text-sm font-medium", i === step ? "text-ink" : "text-muted")}>{s}</span>
              {i < 2 && <div className="flex-1 h-px bg-line" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="mt-6 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Tell us about the job</h2>
                  <Button size="sm" variant="ghost" onClick={() => setForm(SAMPLE)}><Wand2 className="h-3.5 w-3.5" /> Fill sample</Button>
                </div>
                <Field label="Project name"><input value={form.name} onChange={set("name")} className="inp" placeholder="Maple St Kitchen Remodel" /></Field>
                <Field label="Site address"><input value={form.address} onChange={set("address")} className="inp" placeholder="412 Maple St" /></Field>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="Contractor"><input value={form.contractorName} onChange={set("contractorName")} className="inp" /></Field>
                  <Field label="Company"><input value={form.company} onChange={set("company")} className="inp" /></Field>
                  <Field label="Client"><input value={form.clientName} onChange={set("clientName")} className="inp" /></Field>
                </div>
                <Field label="Scope description" hint="Plain English is fine. The agent turns this into a priced baseline.">
                  <textarea value={form.description} onChange={set("description")} rows={5} className="inp !h-auto py-2" placeholder="Full kitchen remodel, ~220 sq ft…" />
                </Field>
                <div className="flex justify-end">
                  <Button disabled={!valid} onClick={() => setStep(1)}>Next <ArrowRight className="h-4 w-4" /></Button>
                </div>
              </Card>
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="mt-6 p-6">
                <h2 className="text-xl font-semibold">Your rates</h2>
                <p className="text-sm text-muted mt-1">Every change order is priced from this sheet. Upload a CSV with columns <span className="font-mono text-[12px]">sku, name, category, unit, price</span>.</p>
                <div className="mt-5 grid sm:grid-cols-2 gap-3">
                  <button onClick={() => { setSheet(SAMPLE_PRICE_SHEET); setSheetSource("Sample remodel rate sheet"); }} className={clsx("rounded-2xl border-2 p-4 text-left cursor-pointer transition-colors", sheetSource.startsWith("Sample") ? "border-accent bg-accent/5" : "border-line")}>
                    <FileSpreadsheet className="h-5 w-5 text-accent" />
                    <div className="font-semibold mt-2">Use sample rate sheet</div>
                    <div className="text-[13px] text-muted">{SAMPLE_PRICE_SHEET.length} items: labor, electrical, flooring, cabinets, tile</div>
                  </button>
                  <button onClick={() => file.current?.click()} className={clsx("rounded-2xl border-2 border-dashed p-4 text-left cursor-pointer transition-colors", !sheetSource.startsWith("Sample") ? "border-accent bg-accent/5" : "border-line")}>
                    <Upload className="h-5 w-5 text-agent" />
                    <div className="font-semibold mt-2">Upload CSV</div>
                    <div className="text-[13px] text-muted">{!sheetSource.startsWith("Sample") ? sheetSource : "Your own labor & material rates"}</div>
                  </button>
                  <input ref={file} type="file" accept=".csv" hidden onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const items = parseCsv(await f.text());
                    setSheet(items);
                    setSheetSource(`${f.name} · ${items.length} items`);
                  }} />
                </div>
                <div className="mt-4 rounded-xl border border-line max-h-52 overflow-y-auto scroll-thin divide-y divide-line/70">
                  {sheet.slice(0, 40).map((i) => (
                    <div key={i.sku} className="flex justify-between px-3 py-1.5 text-[13px]">
                      <span><span className="font-mono text-[11px] text-muted mr-2">{i.sku}</span>{i.name}</span>
                      <span className="tabular-nums text-muted">${i.unitPrice}/{i.unit}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-5">
                  <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
                  <Button onClick={() => setStep(2)} disabled={!sheet.length}>Next <ArrowRight className="h-4 w-4" /></Button>
                </div>
              </Card>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="mt-6 p-8 text-center">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-ink grid place-items-center text-white">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-semibold mt-4">Ready to draft {form.name}</h2>
                <p className="text-sm text-muted mt-1 max-w-md mx-auto">The contract agent will write the scope, price the baseline from {sheet.length} rates, propose a payment schedule and set the change-order rules. You and {form.clientName} review and sign.</p>
                <div className="flex justify-center gap-2 mt-6">
                  <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                  <Button variant="agent" size="lg" onClick={create} disabled={busy}>
                    <Sparkles className="h-4 w-4" /> {busy ? "Creating…" : "Create & draft agreement"}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`.inp{width:100%;height:38px;border-radius:8px;border:1px solid var(--line-strong);background:white;padding:0 12px;font-size:14px;outline:none;transition:border-color .15s,box-shadow .15s}.inp:focus{border-color:rgba(15,16,18,.4);box-shadow:0 0 0 4px rgba(15,16,18,.05)}`}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[12.5px] font-medium mb-1">{label}</div>
      {children}
      {hint && <div className="text-[11.5px] text-muted mt-1">{hint}</div>}
    </label>
  );
}
