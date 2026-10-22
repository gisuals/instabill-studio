// Cloud sync with a local offline fallback for drafts, counters and history.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { normalizeState, type DocMode, type DocState } from "./invoice";

const DRAFT_KEY = "gisuals:draft:v1";
const OUTBOX_KEY = "gisuals:outbox:v1";
const COUNTERS_KEY = "gisuals:counters:v1";
const HISTORY_KEY = "gisuals:history:v1";

export interface StoredDraft {
  data: DocState;
  updatedAt: string;
  /** true while local changes have not reached the cloud yet */
  dirty: boolean;
}

export interface CommitPayload {
  docNumber: string;
  year: number;
  seq: number;
  mode: DocMode;
  clientName: string;
  total: number;
  data: DocState;
}

export interface HistoryEntry {
  docNumber: string;
  mode: DocMode;
  clientName: string;
  total: number;
  updatedAt: string;
  data: DocState;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — cloud copy still exists */
  }
}

// ---------- Draft ----------

export function loadLocalDraft(): StoredDraft | null {
  const raw = readJSON<{ data?: unknown; updatedAt?: string; dirty?: boolean } | null>(DRAFT_KEY, null);
  if (!raw || !raw.updatedAt) return null;
  return { data: normalizeState(raw.data), updatedAt: raw.updatedAt, dirty: Boolean(raw.dirty) };
}

export function saveLocalDraft(draft: StoredDraft) {
  writeJSON(DRAFT_KEY, draft);
}

export async function fetchRemoteDraft(): Promise<{ data: DocState; updatedAt: string } | null> {
  const { data, error } = await supabase
    .from("drafts")
    .select("data, updated_at")
    .eq("id", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { data: normalizeState(data.data), updatedAt: data.updated_at };
}

export async function pushRemoteDraft(state: DocState, updatedAt: string) {
  const { error } = await supabase
    .from("drafts")
    .upsert({ id: "active", data: state as unknown as Json, updated_at: updatedAt });
  if (error) throw error;
}

// ---------- Counters ----------

export function loadLocalCounters(): Record<string, number> {
  return readJSON<Record<string, number>>(COUNTERS_KEY, {});
}

function rememberCounter(year: number, lastSeq: number) {
  const all = loadLocalCounters();
  all[String(year)] = Math.max(all[String(year)] ?? 0, lastSeq);
  writeJSON(COUNTERS_KEY, all);
}

export async function fetchLastSeq(year: number): Promise<number> {
  const { data, error } = await supabase
    .from("document_counters")
    .select("last_seq")
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  const last = data?.last_seq ?? 0;
  rememberCounter(year, last);
  return Math.max(last, loadLocalCounters()[String(year)] ?? 0);
}

// ---------- Documents ----------

async function commitRemote(p: CommitPayload): Promise<number> {
  const { data, error } = await supabase.rpc("commit_document", {
    p_doc_number: p.docNumber,
    p_year: p.year,
    p_seq: p.seq,
    p_mode: p.mode,
    p_client_name: p.clientName,
    p_total: p.total,
    p_data: p.data as unknown as Json,
  });
  if (error) throw error;
  return data ?? p.seq;
}

function addLocalHistory(p: CommitPayload) {
  const list = readJSON<HistoryEntry[]>(HISTORY_KEY, []).filter((h) => h.docNumber !== p.docNumber);
  list.unshift({
    docNumber: p.docNumber,
    mode: p.mode,
    clientName: p.clientName,
    total: p.total,
    updatedAt: new Date().toISOString(),
    data: p.data,
  });
  writeJSON(HISTORY_KEY, list.slice(0, 30));
}

/** Saves a document. Returns the counter's last sequence and whether it reached the cloud. */
export async function commitDocument(p: CommitPayload): Promise<{ lastSeq: number; synced: boolean }> {
  addLocalHistory(p);
  rememberCounter(p.year, p.seq);
  try {
    const lastSeq = await commitRemote(p);
    rememberCounter(p.year, lastSeq);
    return { lastSeq, synced: true };
  } catch {
    const outbox = readJSON<CommitPayload[]>(OUTBOX_KEY, []).filter((o) => o.docNumber !== p.docNumber);
    outbox.push(p);
    writeJSON(OUTBOX_KEY, outbox);
    return { lastSeq: p.seq, synced: false };
  }
}

/** Sends any documents saved while offline. Returns how many were delivered. */
export async function flushOutbox(): Promise<number> {
  const outbox = readJSON<CommitPayload[]>(OUTBOX_KEY, []);
  if (!outbox.length) return 0;
  const remaining: CommitPayload[] = [];
  let sent = 0;
  for (const p of outbox) {
    try {
      await commitRemote(p);
      sent++;
    } catch {
      remaining.push(p);
    }
  }
  writeJSON(OUTBOX_KEY, remaining);
  return sent;
}

export function pendingOutboxCount(): number {
  return readJSON<CommitPayload[]>(OUTBOX_KEY, []).length;
}

export async function fetchHistory(limit = 12): Promise<HistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from("documents")
      .select("doc_number, mode, client_name, total, updated_at, data")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const list: HistoryEntry[] = (data ?? []).map((d) => ({
      docNumber: d.doc_number,
      mode: d.mode === "receipt" ? "receipt" : "invoice",
      clientName: d.client_name,
      total: Number(d.total),
      updatedAt: d.updated_at,
      data: normalizeState(d.data),
    }));
    writeJSON(HISTORY_KEY, list);
    return list;
  } catch {
    return readJSON<HistoryEntry[]>(HISTORY_KEY, []).slice(0, limit);
  }
}
