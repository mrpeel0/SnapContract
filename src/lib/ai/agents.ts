import type { Message, Project } from "../types";
import { aiAvailable, structured } from "./claude";
import { offlineAgreement, offlineAnalyze } from "./offline";
import { AgreementDraft, AnalysisResult, type AgreementDraftT, type AnalysisResultT } from "./schemas";
import { priceLine } from "../pricing";
import { repairAgreementBaseline, repairProposals } from "./guardrails";

function priceSheetTable(p: Project) {
  return p.priceSheet.map((i) => `${i.sku} | ${i.name} | ${i.category} | $${i.unitPrice}/${i.unit}`).join("\n");
}

const ANALYZER_SYSTEM = `You are SnapContract's change-order agent. You sit inside a chat between a construction contractor and their client and watch for requests that change the signed project scope.

Your job for each batch of NEW messages:
- Decide whether they request, agree to, or remove work compared with the signed baseline scope. Small talk, scheduling, progress updates and questions about work already in scope are NOT changes; return an empty list.
- For each real change, propose line items using ONLY SKUs from the contractor's price sheet. Quantities must be in that item's unit. Never invent prices; the app computes all money from the sheet.
- Price installed work completely: for a pendant light, include both the install SKU and the fixture SKU.
- For a material swap (e.g. LVP to oak), remove the baseline item at its baseline quantity and add the new item at the same quantity.
- If a detail that changes the price is missing (how many, which material, roughly how big) and you cannot infer it with reasonable confidence, set "question" to ONE short, friendly clarifying question and still include your best-guess lines (qty 0 when the quantity is the unknown).
- If a new message answers an open change order's question, return the completed change with updatesChangeOrderNumber set to that order's number, and question null.
- Group related asks in one message into one change order; unrelated asks (e.g. outlets and flooring) become separate change orders.
- Keep titles under 8 words. Write summaries for a homeowner: plain, specific and neutral.
- scheduleImpactDays: your honest estimate of added working days (0 if none).
- sourceMessageIds: ids of the messages the change came from.`;

export async function analyzeMessages(p: Project, newMsgs: Message[]): Promise<{ result: AnalysisResultT; mode: "live" | "offline" }> {
  if (aiAvailable()) {
    try {
      const recent = p.messages
        .filter((m) => m.author !== "system")
        .slice(-14)
        .map((m) => `[${m.id}] ${m.author}${m.kind !== "text" ? ` (${m.kind})` : ""}: ${m.body}`)
        .join("\n");
      const open = p.changeOrders
        .filter((c) => ["needs_info", "contractor_review", "client_review"].includes(c.status))
        .map(
          (c) =>
            `CO-${c.number} [${c.status}] ${c.title}${c.question ? ` (asked: ${c.question})` : ""}: ` +
            c.lines.map((l) => `${l.action} ${l.qty} ${l.sku}`).join(", "),
        )
        .join("\n");
      const baseline = p.agreement.baseline
        .map((l) => {
          const pl = priceLine(p.priceSheet, l);
          return `${l.sku} x ${l.qty} ${pl.unit} (${pl.name})`;
        })
        .join("\n");

      const user = `<price_sheet>\n${priceSheetTable(p)}\n</price_sheet>

<signed_scope>\n${p.agreement.summary}\n${baseline}\n</signed_scope>

<open_change_orders>\n${open || "none"}\n</open_change_orders>

<conversation>\n${recent}\n</conversation>

NEW messages to analyze: ${newMsgs.map((m) => m.id).join(", ")}`;

      const result = await structured({ system: ANALYZER_SYSTEM, user, schema: AnalysisResult, effort: "low" });
      if (result) {
        return { result: repairProposals(p, newMsgs, result), mode: "live" };
      }
    } catch (e) {
      console.error("[ai] analyze failed, using offline engine", e);
    }
  }
  return { result: offlineAnalyze(p, newMsgs), mode: "offline" };
}

const AGREEMENT_SYSTEM = `You draft clear, fair residential construction agreements for SnapContract.
Use the project description and ONLY SKUs from the contractor's price sheet to build the baseline line items, with realistic quantities in each item's unit (include reasonable carpentry labor, permit and dumpster if relevant).
Sections, in order: Scope of Work, Materials & Allowances, Exclusions, Change Orders, Payment Terms, Timeline, Warranty. Keep each section 2 to 4 sentences, specific to this project, in plain English.
The Change Orders section must say that changes are priced from the contractor's rate sheet plus the overhead & profit percentage on added work, credits are returned at cost, and no change work starts until the client approves it in SnapContract.
Payment milestones must sum to 100. changeMarkupPct is typically 10 to 15.`;

export async function draftAgreement(p: Project): Promise<{ draft: AgreementDraftT; mode: "live" | "offline" }> {
  if (aiAvailable()) {
    try {
      const user = `<project>\nName: ${p.name}\nAddress: ${p.address}\nContractor: ${p.contractor.name}${p.contractor.company ? ` (${p.contractor.company})` : ""}\nClient: ${p.client.name}\nDescription: ${p.description}\n</project>\n\n<price_sheet>\n${priceSheetTable(p)}\n</price_sheet>`;
      const draft = await structured({ system: AGREEMENT_SYSTEM, user, schema: AgreementDraft, effort: "medium" });
      if (draft) {
        draft.baseline = repairAgreementBaseline(p, draft.baseline);
        const sum = draft.payments.reduce((a, x) => a + x.pct, 0);
        if (sum && sum !== 100) draft.payments = draft.payments.map((x) => ({ ...x, pct: Math.round((x.pct * 100) / sum) }));
        return { draft, mode: "live" };
      }
    } catch (e) {
      console.error("[ai] agreement failed, using template", e);
    }
  }
  return { draft: offlineAgreement(p), mode: "offline" };
}
