import { FilePlus2, History, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DOC_PREFIX,
  createItem,
  formatMoney,
  lineAmount,
  toISODate,
  type DocState,
  type LineItem,
} from "@/lib/invoice";
import type { HistoryEntry } from "@/lib/invoice-sync";
import { ModeToggle } from "./ModeToggle";

interface ControlsPanelProps {
  state: DocState;
  update: (patch: Partial<DocState> | ((s: DocState) => DocState)) => void;
  year: number;
  lastSeq: number;
  seq: number;
  issueDate: Date;
  dueDate: Date;
  history: HistoryEntry[];
  onNewDocument: () => void;
  onLoadHistory: (entry: HistoryEntry) => void;
  showModeToggle?: boolean;
}

function numberValue(n: number) {
  return n === 0 ? "" : String(n);
}

function parseNumber(v: string) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h3>
  );
}

export function ControlsPanel({
  state,
  update,
  year,
  lastSeq,
  seq,
  issueDate,
  dueDate,
  history,
  onNewDocument,
  onLoadHistory,
  showModeToggle = false,
}: ControlsPanelProps) {
  const isInvoice = state.mode === "invoice";

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    update((s) => ({ ...s, items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));

  const addItem = () =>
    update((s) => ({ ...s, items: [...s.items, createItem(crypto.randomUUID())] }));

  const removeItem = (id: string) =>
    update((s) => ({
      ...s,
      items: s.items.length > 1 ? s.items.filter((it) => it.id !== id) : [createItem(crypto.randomUUID())],
    }));

  return (
    <div className="flex flex-col gap-7">
      {showModeToggle && (
        <ModeToggle mode={state.mode} onChange={(mode) => update({ mode })} variant="light" />
      )}

      {/* Number & dates */}
      <section>
        <SectionTitle>Document</SectionTitle>
        <div className="space-y-4">
          <div>
            <Label htmlFor="seq" className="mb-1.5 block text-xs">
              Document number
            </Label>
            <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-card focus-within:ring-1 focus-within:ring-ring">
              <span className="flex items-center bg-muted px-3 font-mono text-xs text-muted-foreground">
                {DOC_PREFIX}-{year}-
              </span>
              <input
                id="seq"
                type="number"
                min={1}
                inputMode="numeric"
                value={seq}
                onChange={(e) => {
                  const n = Math.round(parseFloat(e.target.value));
                  update({ seq: Number.isFinite(n) && n > 0 ? Math.min(n, 99999) : null });
                }}
                className="w-full min-w-0 bg-transparent px-2 font-mono text-sm outline-none"
              />
              {state.seq !== null && (
                <button
                  type="button"
                  onClick={() => update({ seq: null })}
                  className="flex items-center gap-1 border-l border-input px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  title="Use next number automatically"
                >
                  <RotateCcw className="h-3 w-3" /> Auto
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {state.seq === null
                ? `Auto: next number after ${String(lastSeq).padStart(2, "0")}`
                : "Fixed number for this document — tap Auto for the next one"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="issue" className="mb-1.5 block text-xs">
                Date of issue
              </Label>
              <Input
                id="issue"
                type="date"
                value={toISODate(issueDate)}
                onChange={(e) => update({ issueDate: e.target.value || null })}
              />
            </div>
            {isInvoice && (
              <div>
                <Label htmlFor="due" className="mb-1.5 block text-xs">
                  Due date
                </Label>
                <Input
                  id="due"
                  type="date"
                  value={toISODate(dueDate)}
                  onChange={(e) => update({ dueDate: e.target.value || null })}
                />
              </div>
            )}
          </div>
          {(state.issueDate || state.dueDate) && (
            <button
              type="button"
              onClick={() => update({ issueDate: null, dueDate: null })}
              className="flex items-center gap-1 text-xs font-medium text-accent-foreground hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> Reset dates to today
            </button>
          )}
        </div>
      </section>

      {/* Client */}
      <section>
        <SectionTitle>Client</SectionTitle>
        <div className="space-y-3">
          <div>
            <Label htmlFor="client" className="mb-1.5 block text-xs">
              Client name
            </Label>
            <Input
              id="client"
              placeholder="e.g. Adaeze Okafor"
              value={state.clientName}
              maxLength={200}
              onChange={(e) => update({ clientName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="phone" className="mb-1.5 block text-xs">
              Client WhatsApp number <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="0803 000 0000"
              value={state.clientPhone}
              maxLength={30}
              onChange={(e) => update({ clientPhone: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Items */}
      <section>
        <SectionTitle>Items</SectionTitle>
        <div className="space-y-3">
          {state.items.map((item, index) => (
            <div key={item.id} className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Item {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove item ${index + 1}`}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="Item title, e.g. Brand identity design"
                  value={item.title}
                  maxLength={300}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  aria-label={`Item ${index + 1} title`}
                />
                <Textarea
                  placeholder="Short description (optional)"
                  value={item.description}
                  maxLength={1000}
                  rows={2}
                  className="min-h-[52px] resize-none text-sm"
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  aria-label={`Item ${index + 1} description`}
                />
                <div className="grid grid-cols-[72px_1fr] gap-2">
                  <div>
                    <Label className="mb-1 block text-[11px] text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder="0"
                      value={numberValue(item.qty)}
                      onChange={(e) => updateItem(item.id, { qty: parseNumber(e.target.value) })}
                      aria-label={`Item ${index + 1} quantity`}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[11px] text-muted-foreground">Unit price (₦)</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder="0"
                      value={numberValue(item.unitPrice)}
                      onChange={(e) => updateItem(item.id, { unitPrice: parseNumber(e.target.value) })}
                      aria-label={`Item ${index + 1} unit price`}
                    />
                  </div>
                </div>
                <p className="text-right text-xs text-muted-foreground">
                  Amount: <span className="font-semibold text-foreground">₦{formatMoney(lineAmount(item))}</span>
                </p>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" className="w-full border-dashed" onClick={addItem}>
            <Plus /> Add item
          </Button>
        </div>
      </section>

      {/* Payment */}
      <section>
        <SectionTitle>{isInvoice ? "Payment" : "Receipt details"}</SectionTitle>
        <div className="space-y-3">
          <div>
            <Label htmlFor="paid" className="mb-1.5 block text-xs">
              {isInvoice ? "Amount paid (₦)" : "Total paid (₦)"}
            </Label>
            <Input
              id="paid"
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="0"
              value={numberValue(state.paidAmount)}
              onChange={(e) => update({ paidAmount: parseNumber(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="duration" className="mb-1.5 block text-xs">
              Project duration (days)
            </Label>
            <Input
              id="duration"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={numberValue(state.projectDuration)}
              onChange={(e) => update({ projectDuration: Math.round(parseNumber(e.target.value)) })}
            />
            {isInvoice && (
              <p className="mt-1 text-xs text-muted-foreground">Shown on the receipt.</p>
            )}
          </div>
          {isInvoice && (
            <div>
              <Label htmlFor="notes" className="mb-1.5 block text-xs">
                Payment notes
              </Label>
              <Textarea
                id="notes"
                rows={3}
                maxLength={2000}
                placeholder="e.g. 70% upfront, balance on delivery."
                value={state.paymentNotes}
                onChange={(e) => update({ paymentNotes: e.target.value })}
              />
            </div>
          )}
        </div>
      </section>

      {/* New + history */}
      <section className="border-t pt-6">
        <Button type="button" variant="secondary" className="w-full" onClick={onNewDocument}>
          <FilePlus2 /> Start new document
        </Button>

        {history.length > 0 && (
          <div className="mt-6">
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5">
                <History className="h-3 w-3" /> Recent documents
              </span>
            </SectionTitle>
            <ul className="divide-y rounded-lg border bg-card">
              {history.map((h) => (
                <li key={h.docNumber}>
                  <button
                    type="button"
                    onClick={() => onLoadHistory(h)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-medium">{h.docNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {h.mode === "invoice" ? "Invoice" : "Receipt"} · {h.clientName || "No client"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold">₦{formatMoney(h.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
