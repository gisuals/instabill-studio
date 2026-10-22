// Pure document logic for the Gisuals invoice/receipt generator.

export type DocMode = "invoice" | "receipt";
export type DiscountType = "amount" | "percent";

export interface LineItem {
  id: string;
  title: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface DocState {
  mode: DocMode;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  items: LineItem[];
  paidAmount: number;
  /** Optional discount; 0 = no discount shown. */
  discountValue: number;
  discountType: DiscountType;
  projectDuration: number;
  paymentNotes: string;
  /** Manually chosen sequence per document type. null = next number from that type's counter. */
  seq: Record<DocMode, number | null>;
  /** When false, numbers are typed by hand and saving never moves the automatic counter. */
  autoNumber: boolean;
  /** ISO yyyy-mm-dd overrides. null = automatic (today / issue + 1 day). */
  issueDate: string | null;
  dueDate: string | null;
}

/** A saved client profile used to fill documents quickly. */
export interface ClientProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

export const DOC_PREFIX = "G23923";

export const BUSINESS = {
  name: "Gisuals",
  phone: "+234 708 546 6998",
  email: "contactgisuals@gmail.com",
  bank: "OPAY",
  accountNumber: "7085466998",
  accountName: "GREAT ODAFE-OKWENI",
} as const;

export function createItem(id: string): LineItem {
  return { id, title: "", description: "", qty: 1, unitPrice: 0 };
}

export function createEmptyState(): DocState {
  return {
    mode: "invoice",
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    clientAddress: "",
    items: [createItem("item-1")],
    paidAmount: 0,
    discountValue: 0,
    discountType: "amount",
    projectDuration: 0,
    paymentNotes: "",
    seq: { invoice: null, receipt: null },
    autoNumber: true,
    issueDate: null,
    dueDate: null,
  };
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function isoOrNull(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Safely coerce stored/remote JSON into a valid DocState. */
export function normalizeState(raw: unknown): DocState {
  const base = createEmptyState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Record<keyof DocState, unknown>>;
  const items = Array.isArray(r.items)
    ? r.items.slice(0, 100).map((it, i) => {
        const o = (it ?? {}) as Partial<Record<keyof LineItem, unknown>>;
        return {
          id: str(o.id, 64) || `item-${i + 1}`,
          title: str(o.title, 300),
          description: str(o.description, 1000),
          qty: Math.max(0, num(o.qty, 1)),
          unitPrice: Math.max(0, num(o.unitPrice)),
        };
      })
    : base.items;
  const clampSeq = (v: unknown) =>
    v === null || v === undefined ? null : Math.min(99999, Math.max(1, Math.round(num(v, 1))));
  const seqRaw = (r.seq && typeof r.seq === "object" ? r.seq : {}) as Partial<Record<DocMode, unknown>>;
  const seq = { invoice: clampSeq(seqRaw.invoice), receipt: clampSeq(seqRaw.receipt) };
  return {
    mode: r.mode === "receipt" ? "receipt" : "invoice",
    clientName: str(r.clientName, 200),
    clientPhone: str(r.clientPhone, 30),
    clientEmail: str(r.clientEmail, 200),
    clientAddress: str(r.clientAddress, 500),
    items: items.length ? items : base.items,
    paidAmount: Math.max(0, num(r.paidAmount)),
    discountType: r.discountType === "percent" ? "percent" : "amount",
    discountValue:
      r.discountType === "percent"
        ? Math.min(100, Math.max(0, num(r.discountValue)))
        : Math.max(0, num(r.discountValue)),
    projectDuration: Math.max(0, Math.round(num(r.projectDuration))),
    paymentNotes: str(r.paymentNotes, 2000),
    seq,
    autoNumber: r.autoNumber !== false,
    issueDate: isoOrNull(r.issueDate),
    dueDate: isoOrNull(r.dueDate),
  };
}

/** Coerce a stored client row into a clean profile (trimmed, length-limited). */
export function normalizeClient(raw: unknown): ClientProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Record<keyof ClientProfile, unknown>>;
  const name = str(r.name, 200).trim();
  if (!name) return null;
  return {
    id: str(r.id, 64),
    name,
    phone: str(r.phone, 30).trim(),
    email: str(r.email, 200).trim(),
    address: str(r.address, 500).trim(),
  };
}

/** Saved client with the same name (case/space-insensitive), if any. */
export function findClientByName(clients: ClientProfile[], name: string): ClientProfile | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return clients.find((c) => c.name.trim().toLowerCase() === key);
}

/** Fills the document's client fields from a saved profile. */
export function applyClient(state: DocState, client: ClientProfile): DocState {
  return {
    ...state,
    clientName: client.name,
    clientPhone: client.phone,
    clientEmail: client.email,
    clientAddress: client.address,
  };
}

// ---------- Dates ----------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** e.g. "22nd October, 2026" */
export function formatLongDate(d: Date): string {
  return `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

export function resolveDates(state: DocState, today: Date) {
  const issue = state.issueDate ? fromISODate(state.issueDate) : today;
  const due = state.dueDate ? fromISODate(state.dueDate) : addDays(issue, 1);
  return { issue, due };
}

// ---------- Numbering ----------

export function formatDocNumber(year: number, seq: number): string {
  return `${DOC_PREFIX}-${year}-${String(seq).padStart(2, "0")}`;
}

/** Counters are kept separately per year and document type. */
export function counterKey(year: number, mode: DocMode): string {
  return `${year}:${mode}`;
}

/** The sequence to use for the current type: manual override, otherwise that counter's next value. */
export function resolveSeq(state: DocState, lastSeq: number): number {
  return state.seq[state.mode] ?? lastSeq + 1;
}

// ---------- Money ----------

export function lineAmount(item: LineItem): number {
  return Math.round(item.qty * item.unitPrice * 100) / 100;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * total    = sum of line items
 * discount = optional discount (fixed ₦ or % of total, never more than total)
 * subTotal = total − discount (the amount the client owes overall)
 */
export function computeTotals(state: DocState) {
  const total = round2(state.items.reduce((sum, it) => sum + lineAmount(it), 0));
  const rawDiscount =
    state.discountType === "percent"
      ? (total * Math.min(100, Math.max(0, state.discountValue))) / 100
      : Math.max(0, state.discountValue);
  const discount = round2(Math.min(total, rawDiscount));
  const subTotal = round2(total - discount);
  const paid = state.paidAmount;
  return { total, discount, subTotal, paid, balance: Math.max(0, round2(subTotal - paid)) };
}

export function discountLabel(state: DocState): string {
  return state.discountType === "percent" && state.discountValue > 0
    ? `Discount (${state.discountValue}%)`
    : "Discount";
}

export function formatMoney(n: number): string {
  return n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- WhatsApp ----------

/** Turns a Nigerian/local number into wa.me digits (e.g. 0708… -> 234708…). */
export function normalizeWhatsAppNumber(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = `234${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppText(state: DocState, docNumber: string, today: Date): string {
  const { issue, due } = resolveDates(state, today);
  const { total, discount, subTotal, paid, balance } = computeTotals(state);
  const isInvoice = state.mode === "invoice";
  const lines: string[] = [];
  lines.push(`*GISUALS — ${isInvoice ? "INVOICE" : "RECEIPT"}*`);
  lines.push(`No: ${docNumber}`);
  lines.push(`Date of Issue: ${formatLongDate(issue)}`);
  if (isInvoice) lines.push(`Due Date: ${formatLongDate(due)}`);
  if (state.clientName.trim()) lines.push(`Bill to: ${state.clientName.trim()}`);
  lines.push("");
  lines.push("*Items*");
  state.items
    .filter((it) => it.title.trim() || it.unitPrice > 0)
    .forEach((it) => {
      lines.push(`• ${it.title.trim() || "Item"} × ${it.qty} — ₦${formatMoney(lineAmount(it))}`);
    });
  lines.push("");
  if (isInvoice) {
    lines.push(`Total: ₦${formatMoney(total)}`);
    if (discount > 0) {
      lines.push(`${discountLabel(state)}: −₦${formatMoney(discount)}`);
      lines.push(`Sub Total: ₦${formatMoney(subTotal)}`);
    }
    lines.push(`Paid: ₦${formatMoney(paid)}`);
    lines.push(`*Balance Due: ₦${formatMoney(balance)}*`);
    lines.push("");
    lines.push(`Payment: ${BUSINESS.bank} · ${BUSINESS.accountNumber} · ${BUSINESS.accountName}`);
    if (state.paymentNotes.trim()) lines.push(state.paymentNotes.trim());
  } else {
    if (discount > 0) {
      lines.push(`Total: ₦${formatMoney(total)}`);
      lines.push(`${discountLabel(state)}: −₦${formatMoney(discount)}`);
    }
    lines.push(`Invoice Total: ₦${formatMoney(subTotal)}`);
    lines.push(`*Total Paid: ₦${formatMoney(paid)}*`);
    if (state.projectDuration > 0) lines.push(`Project Duration: ${state.projectDuration} Days`);
  }
  lines.push("");
  lines.push(`Thank you — Gisuals · ${BUSINESS.phone}`);
  return lines.join("\n");
}

export function buildWhatsAppUrl(state: DocState, docNumber: string, today: Date): string {
  const text = encodeURIComponent(buildWhatsAppText(state, docNumber, today));
  const phone = normalizeWhatsAppNumber(state.clientPhone);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}
