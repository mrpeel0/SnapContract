import { z } from "zod";

export const ProposedLine = z.object({
  sku: z.string().describe("Exact SKU from the contractor price sheet"),
  qty: z.number().describe("Quantity in the price sheet's unit. Use 0 only if unknown and you are asking a question."),
  action: z.enum(["add", "remove"]),
  note: z.string().nullable(),
});

export const ProposedChange = z.object({
  title: z.string().describe("Short title, e.g. 'Two outlets at island'"),
  summary: z.string().describe("One or two plain-English sentences the client will read"),
  lines: z.array(ProposedLine),
  assumptions: z.array(z.string()),
  question: z
    .string()
    .nullable()
    .describe("If a detail needed for pricing is missing, the single clarifying question to ask. Otherwise null."),
  scheduleImpactDays: z.number().int(),
  confidence: z.number().describe("0 to 1"),
  updatesChangeOrderNumber: z
    .number()
    .int()
    .nullable()
    .describe("If this completes or revises an open change order, its number. Otherwise null."),
  sourceMessageIds: z.array(z.string()),
});

export const AnalysisResult = z.object({
  changes: z.array(ProposedChange),
});

export type AnalysisResultT = z.infer<typeof AnalysisResult>;
export type ProposedChangeT = z.infer<typeof ProposedChange>;

export const AgreementDraft = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(z.object({ title: z.string(), body: z.string() })),
  baseline: z.array(z.object({ sku: z.string(), qty: z.number(), note: z.string().nullable() })),
  payments: z.array(z.object({ label: z.string(), pct: z.number(), trigger: z.string() })),
  timelineWeeks: z.number().int(),
  changeMarkupPct: z.number(),
});

export type AgreementDraftT = z.infer<typeof AgreementDraft>;
