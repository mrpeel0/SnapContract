import type { Agreement, PriceItem, Project } from "./types";

export const uid = (p = "") => p + Math.random().toString(36).slice(2, 10);

export const SAMPLE_PRICE_SHEET: PriceItem[] = [
  // Labor
  { sku: "LAB-ELEC", name: "Electrician labor", category: "labor", unit: "hr", unitPrice: 95, keywords: ["electrician", "electrical labor"] },
  { sku: "LAB-PLMB", name: "Plumber labor", category: "labor", unit: "hr", unitPrice: 105, keywords: ["plumber", "plumbing labor"] },
  { sku: "LAB-CARP", name: "Carpentry labor", category: "labor", unit: "hr", unitPrice: 75, keywords: ["carpenter", "carpentry", "trim"] },
  { sku: "LAB-GEN", name: "General labor", category: "labor", unit: "hr", unitPrice: 55, keywords: ["labor", "helper"] },
  { sku: "LAB-PAINT", name: "Painter labor", category: "labor", unit: "hr", unitPrice: 60, keywords: ["painter"] },
  // Electrical (installed)
  { sku: "EL-OUT", name: "Standard outlet, installed", category: "install", unit: "ea", unitPrice: 165, keywords: ["outlet", "outlets", "receptacle", "plug"] },
  { sku: "EL-GFCI", name: "GFCI outlet, installed", category: "install", unit: "ea", unitPrice: 210, keywords: ["gfci"] },
  { sku: "EL-USB", name: "USB-C combo outlet, installed", category: "install", unit: "ea", unitPrice: 195, keywords: ["usb", "usb-c", "charging"] },
  { sku: "EL-DIM", name: "Dimmer switch, installed", category: "install", unit: "ea", unitPrice: 140, keywords: ["dimmer", "dimmers"] },
  { sku: "EL-RECESS", name: "Recessed LED can light, installed", category: "install", unit: "ea", unitPrice: 225, keywords: ["recessed", "can light", "cans", "pot light"] },
  { sku: "EL-PEND", name: "Pendant light install (labor + box)", category: "install", unit: "ea", unitPrice: 185, keywords: ["pendant", "pendants"] },
  { sku: "EL-UCL", name: "Under-cabinet LED lighting", category: "install", unit: "lf", unitPrice: 48, keywords: ["under-cabinet", "under cabinet", "led strip"] },
  // Fixtures
  { sku: "FX-PEND", name: "Pendant fixture (mid-grade)", category: "fixture", unit: "ea", unitPrice: 240, keywords: ["pendant", "pendants"] },
  { sku: "FX-FAUCET", name: "Kitchen faucet, pull-down", category: "fixture", unit: "ea", unitPrice: 380, keywords: ["faucet"] },
  { sku: "FX-DISP", name: "Garbage disposal, 3/4 HP", category: "fixture", unit: "ea", unitPrice: 310, keywords: ["disposal"] },
  { sku: "PL-POT", name: "Pot filler, installed", category: "install", unit: "ea", unitPrice: 650, keywords: ["pot filler"] },
  // Flooring
  { sku: "FL-DEMO", name: "Flooring removal & disposal", category: "labor", unit: "sq ft", unitPrice: 1.4, keywords: ["remove floor", "demo floor"] },
  { sku: "FL-LVP", name: "Luxury vinyl plank (material)", category: "material", unit: "sq ft", unitPrice: 4.25, keywords: ["lvp", "vinyl", "vinyl plank"] },
  { sku: "FL-OAK", name: "Engineered white oak (material)", category: "material", unit: "sq ft", unitPrice: 8.9, keywords: ["oak", "hardwood", "wood floor", "white oak"] },
  { sku: "FL-TILE", name: "Porcelain floor tile (material)", category: "material", unit: "sq ft", unitPrice: 6.5, keywords: ["porcelain", "floor tile"] },
  { sku: "FL-INSTALL", name: "Flooring installation", category: "install", unit: "sq ft", unitPrice: 3.75, keywords: ["install floor"] },
  // Cabinets & counters
  { sku: "CB-BASE", name: "Base cabinets (shaker)", category: "material", unit: "lf", unitPrice: 320, keywords: ["base cabinet", "lower cabinet"] },
  { sku: "CB-UPPER", name: "Upper cabinets (shaker)", category: "material", unit: "lf", unitPrice: 260, keywords: ["upper cabinet", "wall cabinet"] },
  { sku: "CB-HW", name: "Cabinet hardware (pull/knob)", category: "material", unit: "ea", unitPrice: 14, keywords: ["hardware", "pulls", "knobs", "handles"] },
  { sku: "CB-ISL", name: "Kitchen island, 6 ft", category: "material", unit: "ea", unitPrice: 4200, keywords: ["new island", "add an island", "another island", "an island"] },
  { sku: "CT-QTZ", name: "Quartz countertop, fabricated", category: "material", unit: "sq ft", unitPrice: 78, keywords: ["quartz"] },
  { sku: "CT-LAM", name: "Laminate countertop", category: "material", unit: "sq ft", unitPrice: 32, keywords: ["laminate"] },
  // Backsplash & paint
  { sku: "BS-SUB", name: "Ceramic subway tile (material)", category: "material", unit: "sq ft", unitPrice: 12, keywords: ["subway"] },
  { sku: "BS-ZEL", name: "Zellige tile (material)", category: "material", unit: "sq ft", unitPrice: 28, keywords: ["zellige"] },
  { sku: "BS-INSTALL", name: "Backsplash tile installation", category: "install", unit: "sq ft", unitPrice: 14, keywords: ["backsplash"] },
  { sku: "PT-WALL", name: "Interior wall paint, 2 coats", category: "install", unit: "sq ft", unitPrice: 2.1, keywords: ["paint", "repaint"] },
  // Fees
  { sku: "FE-PERMIT", name: "Permit / permit revision", category: "fee", unit: "ea", unitPrice: 250, keywords: ["permit"] },
  { sku: "FE-DUMP", name: "Dumpster haul", category: "fee", unit: "ea", unitPrice: 450, keywords: ["dumpster"] },
];

export function emptyAgreement(): Agreement {
  return {
    status: "none",
    title: "",
    summary: "",
    sections: [],
    baseline: [],
    payments: [],
    changeMarkupPct: 10,
    timelineWeeks: 6,
    signatures: {},
    draftedBy: "template",
  };
}

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

export const DEMO_DESCRIPTION =
  "Full kitchen remodel, about 220 sq ft. Tear out old vinyl and install LVP flooring. New shaker cabinets (18 lf base, 14 lf upper), quartz countertops (~45 sq ft), subway tile backsplash (~30 sq ft). Electrical: 6 standard outlets, 2 GFCI by the sink, 6 recessed lights. New faucet and disposal. Paint walls and ceiling. Client wants it done in about 6 weeks.";

export function demoProject(): Project {
  const id = "maple-kitchen";
  const coId = "co_usb";
  const agreement: Agreement = {
    status: "signed",
    title: "Kitchen Remodel Agreement: 412 Maple St",
    summary:
      "Complete renovation of a ~220 sq ft kitchen including flooring, cabinetry, quartz countertops, backsplash, electrical upgrades, plumbing fixtures and paint.",
    sections: [
      {
        title: "Scope of Work",
        body: "Demolition of existing vinyl flooring and disposal. Supply and install luxury vinyl plank across ~220 sq ft. Supply and install 18 lf of shaker base cabinets and 14 lf of upper cabinets. Fabricate and install ~45 sq ft quartz countertops. Install ~30 sq ft ceramic subway tile backsplash. Install 6 standard outlets, 2 GFCI outlets and 6 recessed LED lights. Install new pull-down faucet and 3/4 HP disposal. Paint walls and ceiling (2 coats).",
      },
      {
        title: "Exclusions",
        body: "Appliances, structural changes, relocation of plumbing supply/drain lines, and any work outside the kitchen footprint are excluded unless added by an approved change order.",
      },
      {
        title: "Change Orders",
        body: "Any change to scope, materials or quantities must be documented as a written change order priced from the Contractor's rate sheet plus 10% overhead & profit on added work. Credits for removed work are passed back at cost. No change work begins until the Client approves the change order in SnapContract.",
      },
      {
        title: "Timeline",
        body: "Estimated 6 weeks from start date. Approved change orders may extend the schedule by the number of days stated on each change order.",
      },
      {
        title: "Warranty",
        body: "Contractor warrants workmanship for 12 months after final walkthrough. Manufacturer warranties apply to materials and fixtures.",
      },
    ],
    baseline: [
      { id: "b1", sku: "FL-DEMO", qty: 220 },
      { id: "b2", sku: "FL-LVP", qty: 220 },
      { id: "b3", sku: "FL-INSTALL", qty: 220 },
      { id: "b4", sku: "CB-BASE", qty: 18 },
      { id: "b5", sku: "CB-UPPER", qty: 14 },
      { id: "b6", sku: "CB-HW", qty: 28 },
      { id: "b7", sku: "CT-QTZ", qty: 45 },
      { id: "b8", sku: "BS-SUB", qty: 30 },
      { id: "b9", sku: "BS-INSTALL", qty: 30 },
      { id: "b10", sku: "EL-OUT", qty: 6 },
      { id: "b11", sku: "EL-GFCI", qty: 2 },
      { id: "b12", sku: "EL-RECESS", qty: 6 },
      { id: "b13", sku: "FX-FAUCET", qty: 1 },
      { id: "b14", sku: "FX-DISP", qty: 1 },
      { id: "b15", sku: "PT-WALL", qty: 480 },
      { id: "b16", sku: "LAB-CARP", qty: 40 },
      { id: "b17", sku: "FE-PERMIT", qty: 1 },
      { id: "b18", sku: "FE-DUMP", qty: 1 },
    ],
    payments: [
      { label: "Deposit", pct: 30, trigger: "On signing" },
      { label: "Cabinets installed", pct: 30, trigger: "Cabinets set and leveled" },
      { label: "Countertops installed", pct: 30, trigger: "Quartz templated and installed" },
      { label: "Final walkthrough", pct: 10, trigger: "Punch list complete" },
    ],
    changeMarkupPct: 10,
    timelineWeeks: 6,
    signatures: {
      contractor: { name: "Marcus Reyes", at: ago(60 * 24 * 6) },
      client: { name: "Priya Shah", at: ago(60 * 24 * 6 - 40) },
    },
    draftedBy: "ai",
  };

  return {
    id,
    name: "Maple St Kitchen Remodel",
    address: "412 Maple St, Hartford, CT",
    description: DEMO_DESCRIPTION,
    contractor: { name: "Marcus Reyes", company: "Reyes Build Co." },
    client: { name: "Priya Shah" },
    createdAt: ago(60 * 24 * 7),
    priceSheet: SAMPLE_PRICE_SHEET,
    agreement,
    changeOrders: [
      {
        id: coId,
        number: 1,
        title: "USB-C outlet at desk nook",
        summary: "Swap one planned standard outlet at the desk nook for a USB-C combo outlet.",
        status: "approved",
        lines: [
          { id: "l1", sku: "EL-USB", qty: 1, action: "add" },
          { id: "l2", sku: "EL-OUT", qty: 1, action: "remove" },
        ],
        assumptions: ["Uses existing box location; no new circuit."],
        scheduleImpactDays: 0,
        confidence: 0.94,
        sourceMessageIds: ["m3"],
        approval: { name: "Priya Shah", at: ago(60 * 24 * 3), total: 33 },
        createdAt: ago(60 * 24 * 3 + 30),
        history: [
          { at: ago(60 * 24 * 3 + 30), actor: "agent", action: "Detected change from chat" },
          { at: ago(60 * 24 * 3 + 20), actor: "contractor", action: "Sent to client" },
          { at: ago(60 * 24 * 3), actor: "client", action: "Approved", note: "Signed by Priya Shah" },
        ],
      },
    ],
    messages: [
      { id: "m0", author: "system", kind: "event", body: "Agreement signed by both parties · baseline locked", createdAt: ago(60 * 24 * 6 - 40) },
      { id: "m1", author: "contractor", kind: "text", body: "Demo starts Monday at 8am. Dumpster drops off Friday afternoon.", createdAt: ago(60 * 24 * 5) },
      { id: "m2", author: "client", kind: "text", body: "Perfect, we'll clear the counters this weekend!", createdAt: ago(60 * 24 * 5 - 15) },
      { id: "m3", author: "client", kind: "text", body: "Could the outlet by the desk nook be one of those USB-C ones instead?", createdAt: ago(60 * 24 * 3 + 32) },
      { id: "m4", author: "agent", kind: "text", body: "Change order drafted", createdAt: ago(60 * 24 * 3 + 30), changeOrderId: coId },
      { id: "m5", author: "system", kind: "event", body: "CO-1 approved by Priya Shah · invoice updated to v2", createdAt: ago(60 * 24 * 3) },
      { id: "m6", author: "contractor", kind: "text", body: "Cabinets are in! Countertop templating is booked for Thursday.", createdAt: ago(60 * 5) },
    ],
    invoices: [
      { version: 1, createdAt: ago(60 * 24 * 6 - 40), reason: "Agreement signed", total: 0, changeOrderIds: [] },
      { version: 2, createdAt: ago(60 * 24 * 3), reason: "CO-1 approved", total: 0, changeOrderIds: [coId] },
    ],
    agentStatus: "idle",
  };
}
