"use client";
import clsx from "clsx";
import { useRef, useState } from "react";
import { Plus, Search, Trash2, Upload } from "lucide-react";
import type { PriceCategory, PriceItem, Project, Role } from "@/lib/types";
import { Button, Card } from "./ui";
import type { Act } from "./useProject";

const CATS: PriceCategory[] = ["labor", "material", "install", "fixture", "fee"];
const CAT_CLS: Record<PriceCategory, string> = {
  labor: "bg-sky-100 text-sky-700",
  material: "bg-amber-100 text-amber-800",
  install: "bg-violet-100 text-violet-700",
  fixture: "bg-emerald-100 text-emerald-700",
  fee: "bg-stone-200 text-stone-700",
};

export function parseCsv(text: string): PriceItem[] {
  const rows = text.trim().split(/\r?\n/).map((r) => r.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  const header = rows[0].map((h) => h.toLowerCase());
  const idx = (k: string) => header.findIndex((h) => h.includes(k));
  const [iS, iN, iC, iU, iP] = [idx("sku"), idx("name"), idx("cat"), idx("unit"), idx("price")];
  return rows.slice(1).filter((r) => r.length > 2).map((r, i) => ({
    sku: r[iS] || `ITEM-${i + 1}`,
    name: r[iN] || r[0],
    category: (CATS.includes(r[iC] as PriceCategory) ? r[iC] : "material") as PriceCategory,
    unit: r[iU] || "ea",
    unitPrice: Number(r[iP]?.replace(/[$,]/g, "")) || 0,
    keywords: (r[iN] || "").toLowerCase().split(/\W+/).filter((w) => w.length > 3),
  }));
}

export function RateSheet({ project, role, act }: { project: Project; role: Role; act: Act }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<PriceCategory | "all">("all");
  const file = useRef<HTMLInputElement>(null);
  const editable = role === "contractor";
  const items = project.priceSheet.filter((i) => (cat === "all" || i.category === cat) && (i.name + i.sku).toLowerCase().includes(q.toLowerCase()));

  const save = (next: PriceItem[]) => act({ type: "updatePriceSheet", items: next });
  const patch = (sku: string, p: Partial<PriceItem>) => save(project.priceSheet.map((i) => (i.sku === sku ? { ...i, ...p } : i)));

  return (
    <div className="max-w-5xl mx-auto py-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rates…" className="h-10 w-64 rounded-xl border border-line bg-white pl-9 pr-3 text-sm" />
        </div>
        {(["all", ...CATS] as const).map((c) => (
          <button key={c} onClick={() => setCat(c)} className={clsx("rounded-full px-3 py-1.5 text-[12.5px] font-medium capitalize border cursor-pointer", cat === c ? "bg-ink text-white border-ink" : "bg-white border-line")}>
            {c}
          </button>
        ))}
        {editable && (
          <div className="ml-auto flex gap-2">
            <input
              ref={file}
              type="file"
              accept=".csv"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) save(parseCsv(await f.text()));
              }}
            />
            <Button size="sm" variant="outline" onClick={() => file.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
            <Button size="sm" variant="dark" onClick={() => save([...project.priceSheet, { sku: `NEW-${project.priceSheet.length + 1}`, name: "New item", category: "material", unit: "ea", unitPrice: 0 }])}>
              <Plus className="h-3.5 w-3.5" /> Add rate
            </Button>
          </div>
        )}
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-bg/70 text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">SKU</th>
              <th className="text-left px-4 py-2.5 font-semibold">Item</th>
              <th className="text-left px-4 py-2.5 font-semibold">Category</th>
              <th className="text-right px-4 py-2.5 font-semibold">Rate</th>
              <th className="text-left px-4 py-2.5 font-semibold">Unit</th>
              {editable && <th />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {items.map((i) => (
              <tr key={i.sku} className="hover:bg-bg/40">
                <td className="px-4 py-2 font-mono text-[11.5px] text-muted">{i.sku}</td>
                <td className="px-4 py-2">
                  {editable ? <input defaultValue={i.name} onBlur={(e) => e.target.value !== i.name && patch(i.sku, { name: e.target.value })} className="w-full bg-transparent outline-none focus:bg-white rounded px-1 -mx-1" /> : i.name}
                </td>
                <td className="px-4 py-2">
                  <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", CAT_CLS[i.category])}>{i.category}</span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {editable ? (
                    <span className="inline-flex items-center gap-0.5">
                      $<input type="number" step="0.01" defaultValue={i.unitPrice} onBlur={(e) => Number(e.target.value) !== i.unitPrice && patch(i.sku, { unitPrice: Number(e.target.value) })} className="w-20 text-right bg-transparent outline-none focus:bg-white rounded" />
                    </span>
                  ) : (
                    `$${i.unitPrice}`
                  )}
                </td>
                <td className="px-4 py-2 text-muted">/{i.unit}</td>
                {editable && (
                  <td className="pr-3">
                    <button onClick={() => save(project.priceSheet.filter((x) => x.sku !== i.sku))} className="text-muted hover:text-bad cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-[12px] text-muted mt-3">The agent only prices changes with items from this sheet. All totals are calculated in code from these rates, never estimated by the AI.</p>
    </div>
  );
}
