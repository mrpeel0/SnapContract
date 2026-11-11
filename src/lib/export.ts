import type { InvoiceVersion, Project } from "./types";
import { money, priceLine, quoteChange } from "./pricing";

export interface BookLine {
  kind: "baseline" | "change" | "markup";
  ref: string;
  sku: string;
  description: string;
  qty: number | null;
  unit: string;
  unitPrice: number | null;
  amount: number;
  changeOrderNumber: number | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export function linesForInvoice(p: Project, version: InvoiceVersion): BookLine[] {
  const ids = new Set(version.changeOrderIds);
  const lines: BookLine[] = p.agreement.baseline.map((l) => {
    const pl = priceLine(p.priceSheet, l);
    return {
      kind: "baseline",
      ref: "BASE",
      sku: pl.sku,
      description: pl.name,
      qty: pl.qty,
      unit: pl.unit,
      unitPrice: pl.unitPrice,
      amount: pl.total,
      changeOrderNumber: null,
      approvedBy: p.agreement.signatures.client?.name ?? null,
      approvedAt: p.agreement.signatures.client?.at ?? null,
    };
  });
  for (const co of p.changeOrders) {
    if (!ids.has(co.id) || co.status !== "approved") continue;
    const q = quoteChange(p, co);
    for (const l of q.lines) {
      lines.push({
        kind: "change",
        ref: `CO-${co.number}`,
        sku: l.sku,
        description: `${l.sign < 0 ? "Credit: " : ""}${l.name}`,
        qty: l.qty,
        unit: l.unit,
        unitPrice: l.unitPrice,
        amount: l.total,
        changeOrderNumber: co.number,
        approvedBy: co.approval?.name ?? null,
        approvedAt: co.approval?.at ?? null,
      });
    }
    if (q.markup !== 0) {
      lines.push({
        kind: "markup",
        ref: `CO-${co.number}`,
        sku: "O&P",
        description: `Overhead & profit ${q.markupPct}%`,
        qty: null,
        unit: "",
        unitPrice: null,
        amount: q.markup,
        changeOrderNumber: co.number,
        approvedBy: co.approval?.name ?? null,
        approvedAt: co.approval?.at ?? null,
      });
    }
  }
  return lines;
}

function csvCell(v: string | number | null) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: (string | number | null)[][]) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export function accountingCsv(p: Project, version: InvoiceVersion) {
  const lines = linesForInvoice(p, version);
  return csv([
    ["project", "invoice", "kind", "ref", "sku", "description", "qty", "unit", "unit_price", "amount", "approved_by", "approved_at"],
    ...lines.map((l) => [p.name, `v${version.version}`, l.kind, l.ref, l.sku, l.description, l.qty, l.unit, l.unitPrice, l.amount.toFixed(2), l.approvedBy, l.approvedAt]),
  ]);
}

export function accountingJson(p: Project, version: InvoiceVersion) {
  const lines = linesForInvoice(p, version);
  const ids = new Set(version.changeOrderIds);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      destination: "accounting",
      project: {
        id: p.id,
        name: p.name,
        address: p.address,
        client: p.client,
        contractor: p.contractor,
      },
      invoice: {
        version: version.version,
        createdAt: version.createdAt,
        reason: version.reason,
        total: version.total,
      },
      lines,
      changeOrders: p.changeOrders
        .filter((c) => ids.has(c.id))
        .map((c) => ({
          number: c.number,
          title: c.title,
          status: c.status,
          approval: c.approval ?? null,
          scheduleImpactDays: c.scheduleImpactDays,
        })),
      purchases: (p.purchases ?? []).map((card) => ({
        id: card.id,
        changeOrderNumber: card.changeOrderNumber,
        amount: card.amount,
        last4: card.last4,
        memo: card.memo,
        createdAt: card.createdAt,
      })),
    },
    null,
    2,
  );
}

export function quickbooksText(p: Project, version: InvoiceVersion) {
  const lines = linesForInvoice(p, version);
  const body = lines
    .map((l) => {
      const qty = l.qty == null ? "" : `${l.qty} ${l.unit}`.trim();
      const sig = l.approvedBy ? `  [${l.approvedBy}]` : "";
      return `${l.ref.padEnd(8)} ${l.description}${qty ? ` (${qty})` : ""}${sig}`.padEnd(64) + money(l.amount);
    })
    .join("\n");
  return [
    `SNAPCONTRACT INVOICE v${version.version}`,
    p.name,
    p.address,
    `Bill to: ${p.client.name}`,
    `From: ${p.contractor.company ?? p.contractor.name}`,
    `Date: ${new Date(version.createdAt).toLocaleDateString()}`,
    "",
    body,
    "",
    `TOTAL`.padEnd(64) + money(version.total),
  ].join("\n");
}

export function auditCsv(p: Project) {
  return csv([
    ["project", "co", "title", "status", "at", "actor", "action", "note", "approved_by", "approved_total"],
    ...p.changeOrders.flatMap((co) =>
      co.history.map((h) => [p.name, `CO-${co.number}`, co.title, co.status, h.at, h.actor, h.action, h.note ?? "", co.approval?.name ?? "", co.approval?.total ?? ""]),
    ),
  ]);
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
