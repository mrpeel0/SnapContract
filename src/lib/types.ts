export type Role = "contractor" | "client";
export type Author = Role | "agent" | "system";

export type PriceCategory = "labor" | "material" | "install" | "fixture" | "fee";

export interface PriceItem {
  sku: string;
  name: string;
  category: PriceCategory;
  unit: string; // "ea", "sq ft", "hr", "lf"
  unitPrice: number;
  keywords?: string[]; // helps the offline matcher
}

export interface LineItem {
  id: string;
  sku: string;
  qty: number;
  note?: string;
}

export interface ChangeLine extends LineItem {
  action: "add" | "remove";
}

export interface AgreementSection {
  title: string;
  body: string;
}

export interface PaymentMilestone {
  label: string;
  pct: number;
  trigger: string;
}

export interface Signature {
  name: string;
  at: string;
}

export interface Agreement {
  status: "none" | "drafting" | "draft" | "signed";
  title: string;
  summary: string;
  sections: AgreementSection[];
  baseline: LineItem[];
  payments: PaymentMilestone[];
  changeMarkupPct: number; // overhead & profit applied to change orders
  timelineWeeks: number;
  signatures: { contractor?: Signature; client?: Signature };
  draftedBy: "ai" | "template";
}

export type ChangeStatus =
  | "needs_info"
  | "contractor_review"
  | "client_review"
  | "approved"
  | "declined"
  | "void";

export interface ChangeEvent {
  at: string;
  actor: Author;
  action: string;
  note?: string;
}

export interface ChangeOrder {
  id: string;
  number: number;
  title: string;
  summary: string;
  status: ChangeStatus;
  lines: ChangeLine[];
  assumptions: string[];
  question?: string;
  scheduleImpactDays: number;
  confidence: number; // 0..1
  sourceMessageIds: string[];
  contractorNote?: string;
  declineReason?: string;
  approval?: Signature & { total: number };
  createdAt: string;
  history: ChangeEvent[];
}

export type MessageKind = "text" | "voice" | "transcript" | "event";

export interface Message {
  id: string;
  author: Author;
  kind: MessageKind;
  body: string;
  createdAt: string;
  changeOrderId?: string; // agent cards link to a change order
  visibleTo?: Role[]; // undefined = everyone
}

export interface InvoiceVersion {
  version: number;
  createdAt: string;
  reason: string;
  total: number;
  changeOrderIds: string[];
}

export interface RampTransaction {
  id: string;
  amount: number;
  merchant: string;
  at: string;
  state: string;
}

/** Materials spend. A Ramp fund when credentials are set, otherwise a local demo card. */
export interface MaterialPurchase {
  id: string;
  changeOrderId: string;
  changeOrderNumber: number;
  createdAt: string;
  amount: number;
  last4: string;
  merchant: string;
  status: "issued";
  memo: string;
  source?: "ramp" | "demo";
  rampFundId?: string;
  rampCardId?: string;
  transactions?: RampTransaction[];
}

export interface TelegramChannel {
  contractorChatId?: number;
  clientChatId?: number;
  deliveredIds?: string[];
}

export interface Party {
  name: string;
  company?: string;
  email?: string;
}

export interface Project {
  id: string;
  name: string;
  address: string;
  description: string;
  contractor: Party;
  client: Party;
  createdAt: string;
  priceSheet: PriceItem[];
  agreement: Agreement;
  messages: Message[];
  changeOrders: ChangeOrder[];
  invoices: InvoiceVersion[];
  purchases: MaterialPurchase[];
  channels?: { telegram?: TelegramChannel };
  agentStatus: "idle" | "thinking";
  agentStatusText?: string;
  aiMode?: "live" | "offline";
}
