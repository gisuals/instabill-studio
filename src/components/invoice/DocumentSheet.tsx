import { forwardRef } from "react";
import {
  BUSINESS,
  computeTotals,
  discountLabel,
  formatLongDate,
  formatMoney,
  lineAmount,
  type DocState,
} from "@/lib/invoice";

interface DocumentSheetProps {
  state: DocState;
  docNumber: string;
  issueDate: Date;
  dueDate: Date;
}

export const SHEET_WIDTH = 794;
// A4 at 96dpi is 793.7 × 1122.5px; stay just under so the PDF never spills onto a blank page.
export const SHEET_HEIGHT = 1120;

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-doc-accent">
        <div className="h-[18px] w-[18px] rounded-full border-[4px] border-doc-on-accent" />
        <div className="absolute right-[7px] top-[16px] h-[4px] w-[9px] rounded-full bg-doc-on-accent" />
        <div className="absolute right-[6px] top-[9px] h-[8px] w-[7px] bg-doc-accent" />
      </div>
      <span className="text-[22px] font-extrabold leading-none tracking-[0.12em] text-doc-ink">
        GISUALS
      </span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[13px] font-semibold leading-tight text-doc-ink">{label}</p>
      <p className="mt-0.5 text-[13px] font-normal leading-tight text-doc-muted">{value}</p>
    </div>
  );
}

const PILLS = [
  "w-14 bg-doc-accent",
  "w-3 bg-doc-ink",
  "w-3 bg-doc-accent",
  "w-8 bg-doc-ink",
  "w-3 bg-doc-accent",
  "w-3 bg-doc-ink",
  "w-20 bg-doc-accent",
  "w-3 bg-doc-ink",
  "w-6 bg-doc-accent",
  "w-3 bg-doc-ink",
];

export const DocumentSheet = forwardRef<HTMLDivElement, DocumentSheetProps>(
  ({ state, docNumber, issueDate, dueDate }, ref) => {
    const isInvoice = state.mode === "invoice";
    const { total, discount, subTotal, paid } = computeTotals(state);
    const discountRow =
      discount > 0 ? (
        <div className="flex justify-between px-4 py-2">
          <span className="font-semibold text-doc-ink">{discountLabel(state)}</span>
          <span className="text-doc-ink">−₦{formatMoney(discount)}</span>
        </div>
      ) : null;
    const items = state.items;

    return (
      <div
        ref={ref}
        className="doc-sheet relative flex flex-col overflow-hidden"
        style={{ width: SHEET_WIDTH, minHeight: SHEET_HEIGHT }}
      >
        {/* Watermark */}
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[460px] w-[460px] rounded-full border-[70px] border-doc-accent opacity-[0.07]" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-[150px] w-[150px] rounded-full bg-doc-accent opacity-[0.06]" />

        <div className="relative flex flex-1 flex-col px-14 pb-28 pt-14">
          {/* Header */}
          <header className="flex items-start justify-between">
            <BrandMark />
            <div className="flex flex-col items-end">
              <h1 className="text-[36px] font-extrabold uppercase leading-none tracking-[0.04em] text-doc-ink">
                {isInvoice ? "Invoice" : "Receipt"}
              </h1>
              <div className="mt-2 h-[4px] w-14 rounded-full bg-doc-accent" />
              <div className="mt-5 flex flex-col gap-3">
                <MetaRow label={isInvoice ? "Invoice No." : "Receipt No."} value={docNumber} />
                <MetaRow label="Date of Issue" value={formatLongDate(issueDate)} />
                {isInvoice && <MetaRow label="Due Date" value={formatLongDate(dueDate)} />}
              </div>
            </div>
          </header>

          {/* Billing */}
          <section className="mt-8 grid grid-cols-2 gap-10 text-[14px] leading-relaxed">
            <div>
              <p className="text-doc-muted">Bill to:</p>
              <p className="text-[16px] font-bold text-doc-ink">
                {state.clientName.trim() || "Client Name"}
              </p>
            </div>
            <div>
              <p className="text-doc-muted">Bill from:</p>
              <p className="font-bold text-doc-ink">{BUSINESS.name}</p>
              <p className="text-doc-ink">{BUSINESS.phone}</p>
              <p className="text-doc-ink">{BUSINESS.email}</p>
            </div>
          </section>

          {/* Items table */}
          <section className="mt-9">
            <div className="grid grid-cols-[1fr_64px_140px_140px] items-center rounded-[4px] bg-doc-accent px-4 py-3 text-[12px] font-bold uppercase tracking-[0.06em] text-doc-on-accent">
              <span>Item</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Unit Price (₦)</span>
              <span className="text-right">Amount (₦)</span>
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_64px_140px_140px] items-start border-b px-4 py-3.5 text-[14px]"
              >
                <div className="pr-4">
                  <p className="font-bold text-doc-ink">{item.title.trim() || "Item"}</p>
                  {item.description.trim() && (
                    <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-snug text-doc-muted">
                      {item.description}
                    </p>
                  )}
                </div>
                <span className="text-center text-doc-ink">{item.qty}</span>
                <span className="text-right text-doc-ink">{formatMoney(item.unitPrice)}</span>
                <span className="text-right font-semibold text-doc-ink">
                  {formatMoney(lineAmount(item))}
                </span>
              </div>
            ))}
          </section>

          {/* Totals */}
          <section className="mt-6 flex justify-end">
            <div className="w-[320px] text-[14px]">
              {isInvoice ? (
                <>
                  <div className="flex justify-between px-4 py-2">
                    <span className="font-semibold text-doc-ink">Total</span>
                    <span className="text-doc-ink">₦{formatMoney(total)}</span>
                  </div>
                  {discountRow}
                  <div className="flex justify-between rounded-[4px] bg-doc-accent px-4 py-2.5 font-bold text-doc-on-accent">
                    <span>Sub Total</span>
                    <span>₦{formatMoney(subTotal)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="font-semibold text-doc-ink">Paid</span>
                    <span className="text-doc-ink">₦{formatMoney(paid)}</span>
                  </div>
                </>
              ) : (
                <>
                  {discount > 0 && (
                    <div className="flex justify-between px-4 py-2">
                      <span className="font-semibold text-doc-ink">Total</span>
                      <span className="text-doc-ink">₦{formatMoney(total)}</span>
                    </div>
                  )}
                  {discountRow}
                  <div className="flex justify-between rounded-[4px] bg-doc-accent px-4 py-2.5 font-bold text-doc-on-accent">
                    <span>Invoice Total</span>
                    <span>₦{formatMoney(subTotal)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="font-bold text-doc-ink">Total Paid</span>
                    <span className="font-bold text-doc-ink">₦{formatMoney(paid)}</span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Footer */}
          <section className="mt-10 max-w-[420px]">
            {isInvoice ? (
              <div className="text-[14px] leading-relaxed">
                <p className="mb-1 text-[15px] font-bold text-doc-ink">Payment Details:</p>
                <p className="font-semibold text-doc-ink">{BUSINESS.bank}</p>
                <p className="text-doc-ink">Account: {BUSINESS.accountNumber}</p>
                <p className="text-doc-ink">Name: {BUSINESS.accountName}</p>
                {state.paymentNotes.trim() && (
                  <p className="mt-3 whitespace-pre-line text-[13px] text-doc-muted">
                    {state.paymentNotes}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[15px] font-bold text-doc-ink">
                Project Duration: {state.projectDuration} {state.projectDuration === 1 ? "Day" : "Days"}
              </p>
            )}
          </section>

          <p className="mt-auto pt-10 text-[12px] text-doc-muted">Thank you for choosing Gisuals.</p>
        </div>

        {/* Bottom accents */}
        <div className="absolute bottom-10 left-14 flex items-center gap-2">
          {PILLS.map((cls, i) => (
            <span key={i} className={`h-3 rounded-full ${cls}`} />
          ))}
        </div>
      </div>
    );
  },
);
DocumentSheet.displayName = "DocumentSheet";
