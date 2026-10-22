import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/invoice/Workspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gisuals — Invoice & Receipt Generator" },
      {
        name: "description",
        content: "Create, number and send Gisuals invoices and receipts as polished PDFs or WhatsApp messages.",
      },
      { property: "og:title", content: "Gisuals — Invoice & Receipt Generator" },
      {
        property: "og:description",
        content: "Create, number and send Gisuals invoices and receipts as polished PDFs or WhatsApp messages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function LoadingShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-16 bg-ink" />
      <div className="workspace-grid flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    </div>
  );
}

function Index() {
  return (
    <ClientOnly fallback={<LoadingShell />}>
      <Workspace />
    </ClientOnly>
  );
}
