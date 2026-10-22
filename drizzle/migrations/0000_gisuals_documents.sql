-- Sequence counter per year
CREATE TABLE public.document_counters (
  year integer PRIMARY KEY CHECK (year BETWEEN 2000 AND 2999),
  last_seq integer NOT NULL DEFAULT 0 CHECK (last_seq >= 0 AND last_seq <= 99999),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.document_counters TO anon, authenticated;
GRANT ALL ON public.document_counters TO service_role;
ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Counters are readable" ON public.document_counters
  FOR SELECT TO anon, authenticated USING (true);

-- Issued document history
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number text NOT NULL UNIQUE CHECK (char_length(doc_number) BETWEEN 3 AND 40),
  mode text NOT NULL CHECK (mode IN ('invoice','receipt')),
  client_name text NOT NULL DEFAULT '' CHECK (char_length(client_name) <= 200),
  total numeric(14,2) NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(data) < 200000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.documents TO anon, authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Documents are readable" ON public.documents
  FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX documents_updated_at_idx ON public.documents (updated_at DESC);

-- Single active working draft
CREATE TABLE public.drafts (
  id text PRIMARY KEY CHECK (id = 'active'),
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(data) < 200000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.drafts TO anon, authenticated;
GRANT ALL ON public.drafts TO service_role;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active draft readable" ON public.drafts
  FOR SELECT TO anon, authenticated USING (id = 'active');
CREATE POLICY "Active draft insertable" ON public.drafts
  FOR INSERT TO anon, authenticated WITH CHECK (id = 'active');
CREATE POLICY "Active draft updatable" ON public.drafts
  FOR UPDATE TO anon, authenticated USING (id = 'active') WITH CHECK (id = 'active');

-- Atomically save a document and advance the counter
CREATE OR REPLACE FUNCTION public.commit_document(
  p_doc_number text,
  p_year integer,
  p_seq integer,
  p_mode text,
  p_client_name text,
  p_total numeric,
  p_data jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last integer;
BEGIN
  IF p_mode NOT IN ('invoice','receipt') THEN RAISE EXCEPTION 'invalid mode'; END IF;
  IF p_year < 2000 OR p_year > 2999 THEN RAISE EXCEPTION 'invalid year'; END IF;
  IF p_seq < 1 OR p_seq > 99999 THEN RAISE EXCEPTION 'invalid sequence'; END IF;
  IF p_doc_number IS NULL OR char_length(p_doc_number) NOT BETWEEN 3 AND 40 THEN RAISE EXCEPTION 'invalid number'; END IF;

  INSERT INTO public.documents (doc_number, mode, client_name, total, data)
  VALUES (p_doc_number, p_mode, left(coalesce(p_client_name, ''), 200), coalesce(p_total, 0), coalesce(p_data, '{}'::jsonb))
  ON CONFLICT (doc_number) DO UPDATE
    SET mode = EXCLUDED.mode,
        client_name = EXCLUDED.client_name,
        total = EXCLUDED.total,
        data = EXCLUDED.data,
        updated_at = now();

  INSERT INTO public.document_counters (year, last_seq)
  VALUES (p_year, p_seq)
  ON CONFLICT (year) DO UPDATE
    SET last_seq = GREATEST(public.document_counters.last_seq, EXCLUDED.last_seq),
        updated_at = now()
  RETURNING last_seq INTO v_last;

  RETURN v_last;
END;
$$;
REVOKE ALL ON FUNCTION public.commit_document(text, integer, integer, text, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_document(text, integer, integer, text, text, numeric, jsonb) TO anon, authenticated, service_role;