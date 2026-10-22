import { describe, expect, it } from "vitest";
import {
  buildWhatsAppUrl,
  computeTotals,
  createEmptyState,
  formatDocNumber,
  formatLongDate,
  normalizeWhatsAppNumber,
  resolveDates,
  resolveSeq,
} from "@/lib/invoice";

describe("invoice rules", () => {
  it("formats dates like 22nd October, 2026", () => {
    expect(formatLongDate(new Date(2026, 9, 22))).toBe("22nd October, 2026");
    expect(formatLongDate(new Date(2026, 0, 1))).toBe("1st January, 2026");
    expect(formatLongDate(new Date(2026, 2, 13))).toBe("13th March, 2026");
  });

  it("defaults the due date to one day after the issue date", () => {
    const { issue, due } = resolveDates(createEmptyState(), new Date(2026, 11, 31));
    expect(formatLongDate(issue)).toBe("31st December, 2026");
    expect(formatLongDate(due)).toBe("1st January, 2027");
  });

  it("builds numbers as G23923-YYYY-SEQ with a two-digit minimum", () => {
    expect(formatDocNumber(2026, 8)).toBe("G23923-2026-08");
    expect(formatDocNumber(2026, 123)).toBe("G23923-2026-123");
  });

  it("uses the next counter value unless a manual sequence is set", () => {
    const s = createEmptyState();
    expect(resolveSeq(s, 7)).toBe(8);
    expect(resolveSeq({ ...s, seq: { invoice: 20, receipt: null } }, 7)).toBe(20);
  });

  it("numbers receipts from 08 and invoices from 04 using their own counters", () => {
    const s = createEmptyState();
    const receiptSeq = resolveSeq({ ...s, mode: "receipt" }, 7);
    const invoiceSeq = resolveSeq({ ...s, mode: "invoice" }, 3);
    expect(formatDocNumber(2026, receiptSeq)).toBe("G23923-2026-08");
    expect(formatDocNumber(2026, invoiceSeq)).toBe("G23923-2026-04");
  });

  it("keeps a manual invoice number from leaking into the receipt", () => {
    const s = { ...createEmptyState(), seq: { invoice: 4, receipt: null } };
    expect(resolveSeq({ ...s, mode: "receipt" }, 7)).toBe(8);
  });

  it("totals line items as qty × unit price", () => {
    const s = {
      ...createEmptyState(),
      paidAmount: 50000,
      items: [
        { id: "a", title: "Logo", description: "", qty: 2, unitPrice: 30000 },
        { id: "b", title: "Flyer", description: "", qty: 1, unitPrice: 15000 },
      ],
    };
    expect(computeTotals(s)).toEqual({ total: 75000, discount: 0, subTotal: 75000, paid: 50000, balance: 25000 });
  });

  it("takes a fixed ₦ discount off the total, never below zero", () => {
    const base = {
      ...createEmptyState(),
      items: [{ id: "a", title: "Logo", description: "", qty: 1, unitPrice: 100000 }],
    };
    const fixed = computeTotals({ ...base, discountValue: 15000, discountType: "amount" });
    expect(fixed.discount).toBe(15000);
    expect(fixed.subTotal).toBe(85000);
    expect(computeTotals({ ...base, discountValue: 250000, discountType: "amount" }).subTotal).toBe(0);
  });

  it("takes a % discount off the total", () => {
    const s = {
      ...createEmptyState(),
      paidAmount: 40000,
      discountValue: 10,
      discountType: "percent" as const,
      items: [{ id: "a", title: "Logo", description: "", qty: 2, unitPrice: 50000 }],
    };
    expect(computeTotals(s)).toEqual({ total: 100000, discount: 10000, subTotal: 90000, paid: 40000, balance: 50000 });
  });

  it("converts local Nigerian numbers for WhatsApp", () => {
    expect(normalizeWhatsAppNumber("0708 546 6998")).toBe("2347085466998");
    expect(normalizeWhatsAppNumber("+234 708 546 6998")).toBe("2347085466998");
    const url = buildWhatsAppUrl({ ...createEmptyState(), clientPhone: "07085466998" }, "G23923-2026-08", new Date(2026, 9, 22));
    expect(url.startsWith("https://wa.me/2347085466998?text=")).toBe(true);
  });
});
