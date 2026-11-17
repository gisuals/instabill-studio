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

function PrimaryLogo() {
  return (
    <div className="flex items-center">
      <img
        src="/logo-fullblack.png"
        alt="Gisuals"
        className="-ml-3 -mt-3 h-auto w-[220px] max-w-none object-contain"
      />
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-left">
      <p className="text-[14px] font-bold leading-snug text-doc-ink">{label}:</p>
      <p className="text-[14px] font-normal leading-snug text-doc-ink">{value}</p>
    </div>
  );
}

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
        className="doc-sheet relative flex flex-col overflow-hidden bg-white"
        style={{ width: SHEET_WIDTH, minHeight: SHEET_HEIGHT }}
      >
        {/* Tilted Background Watermark */}
<img
  src="/logo-icon.png"
  alt=""
  className="absolute -bottom-65 -right-88 w-[1050px] h-[1050px] max-w-none opacity-[0.08] pointer-events-none z-0 object-contain rotate-[25deg]"
/>

        <div className="relative z-10 flex flex-1 flex-col px-14 pb-28 pt-14">
          {/* Header & Billing */}
          <header className="flex items-stretch justify-between">
            {/* Left Column: Logo & Bill To */}
            <div className="flex flex-col justify-between">
              <PrimaryLogo/>

              <div className="mt-auto pt-10 text-[14px] leading-relaxed">
                <p className="text-doc-muted">Bill to:</p>
                <p className="text-[16px] font-bold text-doc-ink">
                  {state.clientName.trim() || "Client Name"}
                </p>
              </div>
            </div>

            {/* Right Column: Title, Dates & Bill From (all sharing one left edge) */}
            <div className="flex w-[250px] flex-col items-start text-left">
              <h1 className="text-[38px] font-bold uppercase leading-none tracking-[0.02em] text-doc-ink">
                {isInvoice ? "INVOICE" : "RECEIPT"}
              </h1>

              <div className="mt-5 flex flex-col gap-3">
                <MetaRow
                  label="Date of Issue"
                  value={formatLongDate(issueDate)}
                />
                {isInvoice && (
                  <MetaRow
                    label="Due Date"
                    value={formatLongDate(dueDate)}
                  />
                )}
                <MetaRow
                  label={isInvoice ? "Invoice number" : "Receipt number"}
                  value={docNumber}
                />
              </div>

              <div className="mt-6 text-[14px] leading-relaxed text-doc-ink">
                <p>
                  Bill from: <span className="font-bold">{BUSINESS.name}</span>
                </p>
                <p>{BUSINESS.phone}</p>
                <p>{BUSINESS.email}</p>
              </div>
            </div>
          </header>
  

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
        {/* Visible Black Line above Total */}
        <div className="flex justify-between border-t-2 border-black px-4 pt-3 pb-2">
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
        {/* Visible Black Line above Total (Receipt View) */}
        <div className="flex justify-between border-t-2 border-black px-4 pt-3 pb-2">
          <span className="font-semibold text-doc-ink">Total</span>
          <span className="text-doc-ink">₦{formatMoney(total)}</span>
        </div>
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
          <section className="mt-10 max-w-[460px]">
            {isInvoice ? (
              <div className="leading-snug text-doc-ink">
                <p className="mb-1.5 text-[24px] font-extrabold tracking-tight text-doc-ink">
                  Payment Details:
                </p>
                <div className="space-y-0.5 text-[17px]">
                  <p>
                    Bank Name: <span className="font-bold">{BUSINESS.bank}</span>
                  </p>
                  <p>
                    Account Number: <span className="font-bold">{BUSINESS.accountNumber}</span>
                  </p>
                  <p>
                    Account name: <span className="font-bold">{BUSINESS.accountName}</span>
                  </p>
                </div>

                {state.paymentNotes.trim() && (
                  <div className="mt-4 text-[14px] leading-snug text-doc-ink">
                    <p className="font-bold">Flexible Payment:</p>
                    <p className="whitespace-pre-line">{state.paymentNotes}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[18px] font-bold text-doc-ink">
                Project Duration: {state.projectDuration} {state.projectDuration === 1 ? "Day" : "Days"}
              </p>
            )}
          </section>

          <p className="mt-auto pt-10 text-[12px] text-doc-muted">Thank you for choosing Gisuals.</p>
        </div>

        {/* Bottom Accent Image */}
        <img 
          src="/receipt-bg-footer-element.png" 
          alt="Accent Pattern" 
          className="absolute bottom-0 left-1 h-7 w-auto object-contain pointer-events-none z-10" 
        />
      </div>
    );
  },
);
DocumentSheet.displayName = "DocumentSheet";