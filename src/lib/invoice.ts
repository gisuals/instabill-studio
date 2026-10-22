// Pure document logic for the Gisuals invoice/receipt generator.

export type DocMode = "invoice" | "receipt";

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
  items: LineItem[];
  paidAmount: number;
  projectDuration: number;
  paymentNotes: string;
  /** Manually chosen sequence. null = use the next number from the shared counter. */
  seq: number | null;
  /** ISO yyyy-mm-dd overrides. null = automatic (today / issue + 1 day). */
  issueDate: string | null;
  dueDate: string | null;
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
    items: [createItem("item-1")],
    paidAmount: 0,
    projectDuration: 0,
    paymentNotes: "",
    seq: null,
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
  const r = raw as Record<string, unknown>;
  const items = Array.isArray(r.items)
    ? r.items.slice(0, 100).map((it, i) => {
        const o = (it ?? {}) as Record<string, unknown>;
        return {
          id: str(o.id, 64) || `item-${i + 1}`,
          title: str(o.title, 300),
          description: str(o.description, 1000),
          qty: Math.max(0, num(o.qty, 1)),
          unitPrice: Math.max(0, num(o.unitPrice)),
        };
      })
    : base.items;
  const seqRaw = r.seq;
  const seq =
    seqRaw === null || seqRaw === undefined ? null : Math.min(99999, Math.max(1, Math.round(num(seqRaw, 1))));
  return {
    mode: r.mode === "receipt" ? "receipt" : "invoice",
    clientName: str(r.clientName, 200),
    clientPhone: str(r.clientPhone, 30),
    items: items.length ? items : base.items,
    paidAmount: Math.max(0, num(r.paidAmount)),
    projectDuration: Math.max(0, Math.round(num(r.projectDuration))),
    paymentNotes: str(r.paymentNotes, 2000),
    seq,
    issueDate: isoOrNull(r.issueDate),
    dueDate: isoOrNull(r.dueDate),
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
  const [y, m, d] = iso.split("-").map(Number);
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

/** The sequence to use: manual override, otherwise the counter's next value. */
export function resolveSeq(state: DocState, lastSeq: number): number {
  return state.seq ?? lastSeq + 1;
}

// ---------- Money ----------

export function lineAmount(item: LineItem): number {
  return Math.round(item.qty * item.unitPrice * 100) / 100;
}

export function computeTotals(state: DocState) {
  const total = Math.round(state.items.reduce((sum, it) => sum + lineAmount(it), 0) * 100) / 100;
  const paid = state.paidAmount;
  return { total, subTotal: total, paid, balance: Math.max(0, Math.round((total - paid) * 100) / 100) };
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
  const { total, paid, balance } = computeTotals(state);
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
    lines.push(`Paid: ₦${formatMoney(paid)}`);
    lines.push(`*Balance Due: ₦${formatMoney(balance)}*`);
    lines.push("");
    lines.push(`Payment: ${BUSINESS.bank} · ${BUSINESS.accountNumber} · ${BUSINESS.accountName}`);
    if (state.paymentNotes.trim()) lines.push(state.paymentNotes.trim());
  } else {
    lines.push(`Invoice Total: ₦${formatMoney(total)}`);
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
