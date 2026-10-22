import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cloud, CloudOff, Download, Loader2, MessageCircle, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  buildWhatsAppUrl,
  computeTotals,
  createEmptyState,
  formatDocNumber,
  resolveDates,
  resolveSeq,
  type DocState,
} from "@/lib/invoice";
import {
  commitDocument,
  fetchHistory,
  fetchLastSeq,
  fetchRemoteDraft,
  flushOutbox,
  loadLocalCounters,
  loadLocalDraft,
  pendingOutboxCount,
  pushRemoteDraft,
  saveLocalDraft,
  type HistoryEntry,
} from "@/lib/invoice-sync";
import { ControlsPanel } from "./ControlsPanel";
import { DocumentSheet } from "./DocumentSheet";
import { ModeToggle } from "./ModeToggle";
import { SheetPreview } from "./SheetPreview";

type SyncStatus = "loading" | "saving" | "synced" | "offline";

export function Workspace() {
  const [state, setState] = useState<DocState>(() => createEmptyState());
  const [today, setToday] = useState(() => new Date());
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const skipNextSave = useRef(true);

  const { issue, due } = resolveDates(state, today);
  const year = issue.getFullYear();
  const lastSeq = counters[String(year)] ?? 0;
  const seq = resolveSeq(state, lastSeq);
  const docNumber = formatDocNumber(year, seq);

  const update = useCallback((patch: Partial<DocState> | ((s: DocState) => DocState)) => {
    setState((s) => (typeof patch === "function" ? patch(s) : { ...s, ...patch }));
  }, []);

  const refreshCounter = useCallback(async (y: number) => {
    try {
      const last = await fetchLastSeq(y);
      setCounters((c) => ({ ...c, [String(y)]: Math.max(c[String(y)] ?? 0, last) }));
    } catch {
      /* keep local value */
    }
  }, []);

  // Initial load: local first (instant), then reconcile with the cloud.
  useEffect(() => {
    let cancelled = false;
    setToday(new Date());
    setCounters(loadLocalCounters());
    const local = loadLocalDraft();
    if (local) setState(local.data);

    (async () => {
      let next = local;
      try {
        const remote = await fetchRemoteDraft();
        if (remote && (!local || (!local.dirty && remote.updatedAt > local.updatedAt))) {
          next = { data: remote.data, updatedAt: remote.updatedAt, dirty: false };
          if (!cancelled) setState(remote.data);
          saveLocalDraft(next);
        } else if (local?.dirty) {
          await pushRemoteDraft(local.data, local.updatedAt);
          saveLocalDraft({ ...local, dirty: false });
        }
        await flushOutbox();
        if (!cancelled) setStatus("synced");
      } catch {
        if (!cancelled) setStatus("offline");
      }
      const y = resolveDates(next?.data ?? createEmptyState(), new Date()).issue.getFullYear();
      await refreshCounter(y);
      const h = await fetchHistory();
      if (!cancelled) {
        setHistory(h);
        skipNextSave.current = true;
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCounter]);

  // Autosave: local immediately, cloud after a short pause.
  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const updatedAt = new Date().toISOString();
    saveLocalDraft({ data: state, updatedAt, dirty: true });
    setStatus("saving");
    const t = window.setTimeout(async () => {
      try {
        await pushRemoteDraft(state, updatedAt);
        saveLocalDraft({ data: state, updatedAt, dirty: false });
        setStatus("synced");
      } catch {
        setStatus("offline");
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [state, loaded]);

  // Re-sync when the connection comes back.
  useEffect(() => {
    const onOnline = async () => {
      const local = loadLocalDraft();
      try {
        if (local?.dirty) {
          await pushRemoteDraft(local.data, local.updatedAt);
          saveLocalDraft({ ...local, dirty: false });
        }
        const sent = await flushOutbox();
        if (sent) toast.success(`Synced ${sent} saved document${sent > 1 ? "s" : ""}`);
        setStatus("synced");
        setHistory(await fetchHistory());
      } catch {
        setStatus("offline");
      }
      void refreshCounter(year);
    };
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshCounter, year]);

  // Keep the counter fresh if the issue year changes.
  useEffect(() => {
    if (loaded) void refreshCounter(year);
  }, [year, loaded, refreshCounter]);

  const handleDownload = async () => {
    const el = sheetRef.current;
    if (!el || busy) return;
    setBusy(true);
    try {
      const { default: html2pdf } = await import("html2pdf.js");
      await html2pdf()
        .set({
          margin: 0,
          filename: `${docNumber}-${state.mode}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(el)
        .save();

      const locked: DocState = { ...state, seq };
      const { total } = computeTotals(state);
      const result = await commitDocument({
        docNumber,
        year,
        seq,
        mode: state.mode,
        clientName: state.clientName.trim(),
        total,
        data: locked,
      });
      setState(locked);
      setCounters((c) => ({ ...c, [String(year)]: Math.max(c[String(year)] ?? 0, result.lastSeq) }));
      setHistory(await fetchHistory());
      if (result.synced) {
        toast.success(`${docNumber} downloaded and saved`);
      } else {
        setStatus("offline");
        toast.message(`${docNumber} downloaded`, {
          description: `Saved on this device — it will sync when you're back online (${pendingOutboxCount()} waiting).`,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleWhatsApp = () => {
    window.open(buildWhatsAppUrl(state, docNumber, today), "_blank", "noopener,noreferrer");
  };

  const handleNew = () => {
    setState((s) => ({ ...createEmptyState(), mode: s.mode }));
    void refreshCounter(year);
    setDrawerOpen(false);
    toast.success("New document started");
  };

  const handleLoad = (entry: HistoryEntry) => {
    setState(entry.data);
    setDrawerOpen(false);
    toast.success(`Opened ${entry.docNumber}`);
  };

  const controls = useMemo(
    () => ({
      state,
      update,
      year,
      lastSeq,
      seq,
      issueDate: issue,
      dueDate: due,
      history,
      onNewDocument: handleNew,
      onLoadHistory: handleLoad,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, update, year, lastSeq, seq, issue.getTime(), due.getTime(), history],
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="no-print sticky top-0 z-40 bg-ink text-ink-foreground">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">
              G
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-extrabold tracking-[0.14em]">GISUALS</p>
              <p className="text-[11px] text-ink-muted">Invoice & Receipt Studio</p>
            </div>
          </div>

          <ModeToggle mode={state.mode} onChange={(mode) => update({ mode })} />

          <div className="flex items-center gap-2">
            <SyncBadge status={status} />
            <Button variant="whatsapp" className="hidden lg:inline-flex" onClick={handleWhatsApp}>
              <MessageCircle /> Send to WhatsApp
            </Button>
            <Button className="hidden lg:inline-flex" onClick={handleDownload} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Download />} Download PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop controls */}
        <aside className="no-print sticky top-16 hidden h-[calc(100vh-4rem)] w-[380px] shrink-0 overflow-y-auto border-r bg-sidebar p-6 lg:block">
          <ControlsPanel {...controls} />
        </aside>

        {/* Preview */}
        <main className="workspace-grid flex-1 px-3 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <div className="mx-auto max-w-[794px]">
            <div className="no-print mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">{docNumber}</span>
              <span>A4 preview</span>
            </div>
            <SheetPreview>
              <DocumentSheet ref={sheetRef} state={state} docNumber={docNumber} issueDate={issue} dueDate={due} />
            </SheetPreview>
          </div>
        </main>
      </div>

      {/* Mobile action bar */}
      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 backdrop-blur lg:hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <Button variant="outline" size="lg" className="px-4" onClick={() => setDrawerOpen(true)}>
            <SlidersHorizontal /> Edit details
          </Button>
          <Button variant="whatsapp" size="lg" className="px-4" onClick={handleWhatsApp} aria-label="Send to WhatsApp">
            <MessageCircle />
          </Button>
          <Button size="lg" className="px-4" onClick={handleDownload} disabled={busy} aria-label="Download PDF">
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="no-print max-h-[88vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Edit {state.mode}</DrawerTitle>
            <DrawerDescription className="font-mono text-xs">{docNumber}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8">
            <ControlsPanel {...controls} showModeToggle />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const map = {
    loading: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: "Loading" },
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: "Saving" },
    synced: { icon: <Cloud className="h-3.5 w-3.5 text-success" />, label: "Saved" },
    offline: { icon: <CloudOff className="h-3.5 w-3.5 text-primary" />, label: "Offline" },
  }[status];
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full bg-ink-raised px-3 py-1.5 text-[11px] font-medium text-ink-muted sm:inline-flex"
      title={status === "offline" ? "Changes are kept on this device and will sync when online" : undefined}
    >
      {map.icon}
      {map.label}
    </span>
  );
}
