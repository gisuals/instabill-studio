<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Pure document rules (dates, numbering, totals, WhatsApp text) live in `src/lib/invoice.ts` with tests in `src/test/invoice.test.ts`; keep UI free of business math so rules stay testable.
- All cloud/localStorage sync goes through `src/lib/invoice-sync.ts`; components never call the database directly, so the offline fallback stays in one place.
- Documents are saved and counters advanced only via the `commit_document` database function (atomic, `GREATEST` so counters never go backwards); counters live in `mode_counters`, one per year and document type (`document_counters` is deprecated). Anon clients have no direct write access to documents or counters.
- Manual number overrides are stored per document type (`DocState.seq[mode]`) so an invoice number never leaks onto a receipt.
- The workspace is a single shared studio (one `drafts` row with id `active`, no login); adding auth later means scoping drafts/documents per user.
- `html2canvas` is aliased to `html2canvas-pro` in `vite.config.ts` because the original cannot parse oklch colors used by the design tokens.
- The printable sheet is a fixed 794px-wide element (`DocumentSheet`) kept under A4 height; on small screens it is scaled by a wrapper (`SheetPreview`), never by transforming the captured element itself.
- The workspace renders inside `<ClientOnly>` because it depends on today's date and localStorage.
