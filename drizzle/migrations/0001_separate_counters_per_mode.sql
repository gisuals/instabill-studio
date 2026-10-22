-- Separate sequence counter per year AND document type
CREATE TABLE public.mode_counters (
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2999),
  mode text NOT NULL CHECK (mode IN ('invoice','receipt')),
  last_seq integer NOT NULL DEFAULT 0 CHECK (last_seq >= 0 AND last_seq <= 99999),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, mode)
);
GRANT SELECT ON public.mode_counters TO anon, authenticated;
GRANT ALL ON public.mode_counters TO service_role;
ALTER TABLE public.mode_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mode counters are readable" ON public.mode_counters
  FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE public.document_counters IS 'DEPRECATED: replaced by mode_counters (per document type)';

-- An invoice and a receipt may share the same number
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_doc_number_key;
ALTER TABLE public.documents ADD CONSTRAINT documents_doc_number_mode_key UNIQUE (doc_number, mode);

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
  ON CONFLICT (doc_number, mode) DO UPDATE
    SET client_name = EXCLUDED.client_name,
        total = EXCLUDED.total,
        data = EXCLUDED.data,
        updated_at = now();

  INSERT INTO public.mode_counters (year, mode, last_seq)
  VALUES (p_year, p_mode, p_seq)
  ON CONFLICT (year, mode) DO UPDATE
    SET last_seq = GREATEST(public.mode_counters.last_seq, EXCLUDED.last_seq),
        updated_at = now()
  RETURNING last_seq INTO v_last;

  RETURN v_last;
END;
$$;
REVOKE ALL ON FUNCTION public.commit_document(text, integer, integer, text, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_document(text, integer, integer, text, text, numeric, jsonb) TO anon, authenticated, service_role;