# InstaBill

Build a clean, production-ready single-page Invoice and Receipt generator web app for "Gisuals" connected to a Supabase backend.

Tech Stack:
- React/Next.js with Tailwind CSS.
- Database: `@supabase/supabase-js` for syncing document history, auto-incrementing numbers, and active drafts.
- PDF rendering using 'html2pdf.js'.

Database & Security Setup:
- Connect using environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).
- Persist active document state and current sequence counter in Supabase so data is never lost if browser cache is cleared.
- Ensure all queries comply with Supabase Row Level Security (RLS) rules.
- Fallback: Store state in localStorage if offline, then sync back to Supabase when online.

State Management & Workspace Toggle:
1. Mode Switcher ("INVOICE" vs. "RECEIPT"):
   - Top persistent toggle bar (hidden during PDF export).
   - Dynamic form inputs stay preserved when switching modes.
2. Dynamic Dates & Auto-Numbering:
   - Date of Issue automatically grabs today's system date dynamically (formatted like: "22nd October, 2026").
   - Due Date (Invoice mode) automatically defaults to +1 day from Date of Issue.
   - Dynamic Document Number logic:
     Format: `G23923-{YYYY}-{SEQ}` (e.g., G23923-2026-08).
     {YYYY} auto-detects current year dynamically.
     {SEQ} fetches and increments the global sequence counter directly from Supabase `document_counters` table.
     Provide an editable input field in controls to manually override sequence if needed.

Typography & Design Hierarchy (Matching Visual Templates):
- Colors: Primary Accent #FF7A00 (Vibrant Orange), Dark Text #1A1A1A, Muted Gray #666666, Pure White Canvas.
- Font Family: Clean Sans-Serif (Montserrat or Plus Jakarta Sans style).
- Layout Architecture:
  - Top Left: GISUALS logo text (bold, ~22px) + icon mark.
  - Top Right: Document Header ("INVOICE" or "RECEIPT") in large extra-bold uppercase (~36px).
  - Metadata block right under header (~13px): Label in semi-bold black, values underneath in regular weight.
  - Billing Info (~14px):
    "Bill to: [Client Name]" (bold name).
    "Bill from: Gisuals / +234 708 546 6998 / contactgisuals@gmail.com".
  - Table:
    Header Bar: Solid orange (#FF7A00) background, white uppercase text (~12px bold) for [ITEM, QTY, UNIT PRICE (₦), AMOUNT (₦)].
    Rows (~14px): Bold item titles, description gray below, right-aligned numbers. Dynamic line adding/deleting.
  - Totals Section (Right-aligned):
    Invoice View: Shows "Total", "Sub Total" in orange bar, and "Paid".
    Receipt View: Shows "Invoice Total" in orange bar, followed by "Total Paid".
  - Footers:
    Invoice View: Bold "Payment Details:" (OPAY, Account: 7085466998, Name: GREAT ODAFE-OKWENI) and flexible payment notes.
    Receipt View: Bold "Project Duration: [X] Days" (~15px) aligned to left.
- Background Accents:
  - Faint transparent orange watermark shape fixed in bottom-right corner.
  - Bottom edge: Row of alternating orange and black pill/dot graphic accents.

Toolbar Controls (Hidden during PDF Export / Print):
- Controls bar featuring:
  - Toggle: "Invoice" | "Receipt"
  - Inputs: Client Name, Add/Remove Item Rows (Description, Qty, Unit Price), Paid Amount, Project Duration.
  - Action Buttons: "Download PDF" and "Send to WhatsApp" (opens wa.me link with pre-filled order summary text).
- Responsive mobile controls drawer for quick filling on phone screens.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f154ae3d-469f-51e2-8540-c5c79f4ad233).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
