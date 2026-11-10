import type { ChangeLine, ChangeOrder, LineItem, PriceItem, Project } from "./types";

// All money math lives here. The AI only proposes SKUs and quantities;
// totals are always computed deterministically from the contractor's price sheet.

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function findItem(sheet: PriceItem[], sku: string) {
  return sheet.find((p) => p.sku === sku);
}

export interface PricedLine {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  qty: number;
  sign: 1 | -1;
  total: number;
  note?: string;
  missing?: boolean;
}

export function priceLine(sheet: PriceItem[], line: LineItem | ChangeLine): PricedLine {
  const item = findItem(sheet, line.sku);
  const sign: 1 | -1 = "action" in line && line.action === "remove" ? -1 : 1;
  const unitPrice = item?.unitPrice ?? 0;
  return {
    id: line.id,
    sku: line.sku,
    name: item?.name ?? `Unknown item (${line.sku})`,
    category: item?.category ?? "material",
    unit: item?.unit ?? "ea",
    unitPrice,
    qty: line.qty,
    sign,
    total: round2(sign * unitPrice * line.qty),
    note: line.note,
    missing: !item,
  };
}

export function baselineTotal(p: Project) {
  return round2(p.agreement.baseline.reduce((s, l) => s + priceLine(p.priceSheet, l).total, 0));
}

export interface ChangeQuote {
  lines: PricedLine[];
  subtotal: number;
  markup: number;
  markupPct: number;
  total: number;
  byCategory: Record<string, number>;
}

export function quoteChange(p: Project, co: Pick<ChangeOrder, "lines">): ChangeQuote {
  const lines = co.lines.map((l) => priceLine(p.priceSheet, l));
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const markupPct = p.agreement.changeMarkupPct;
  // Markup only on added work; credits are passed back at cost.
  const addedSubtotal = lines.filter((l) => l.sign > 0).reduce((s, l) => s + l.total, 0);
  const markup = round2((addedSubtotal * markupPct) / 100);
  const byCategory: Record<string, number> = {};
  for (const l of lines) byCategory[l.category] = round2((byCategory[l.category] ?? 0) + l.total);
  return { lines, subtotal, markup, markupPct, total: round2(subtotal + markup), byCategory };
}

export interface BudgetSummary {
  baseline: number;
  approved: number;
  pending: number;
  current: number;
  projected: number;
  approvedCount: number;
  pendingCount: number;
  scheduleDays: number;
}

export function budget(p: Project): BudgetSummary {
  const baseline = baselineTotal(p);
  let approved = 0;
  let pending = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  let scheduleDays = 0;
  for (const co of p.changeOrders) {
    const t = quoteChange(p, co).total;
    if (co.status === "approved") {
      approved += t;
      approvedCount++;
      scheduleDays += co.scheduleImpactDays;
    } else if (["needs_info", "contractor_review", "client_review"].includes(co.status)) {
      pending += t;
      pendingCount++;
    }
  }
  approved = round2(approved);
  pending = round2(pending);
  return {
    baseline,
    approved,
    pending,
    current: round2(baseline + approved),
    projected: round2(baseline + approved + pending),
    approvedCount,
    pendingCount,
    scheduleDays,
  };
}

export const money = (n: number, opts: { sign?: boolean; cents?: boolean } = {}) => {
  const s = Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: opts.cents === false ? 0 : 2,
  });
  if (n < 0) return `−${s}`;
  return opts.sign ? `+${s}` : s;
};
