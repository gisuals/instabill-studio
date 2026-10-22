-- Reusable client profiles for the shared studio (no login yet)
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
  email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 200),
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clients_name_unique ON public.clients (lower(btrim(name)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO anon, authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients are readable" ON public.clients
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Clients are insertable" ON public.clients
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Clients are updatable" ON public.clients
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Clients are deletable" ON public.clients
  FOR DELETE TO anon, authenticated USING (true);

-- Manual numbering: saving a hand-typed number must not move the automatic counter
DROP FUNCTION IF EXISTS public.commit_document(text, integer, integer, text, text, numeric, jsonb);

CREATE FUNCTION public.commit_document(
  p_doc_number text,
  p_year integer,
  p_seq integer,
  p_mode text,
  p_client_name text,
  p_total numeric,
  p_data jsonb,
  p_advance boolean DEFAULT true
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

  IF coalesce(p_advance, true) THEN
    INSERT INTO public.mode_counters (year, mode, last_seq)
    VALUES (p_year, p_mode, p_seq)
    ON CONFLICT (year, mode) DO UPDATE
      SET last_seq = GREATEST(public.mode_counters.last_seq, EXCLUDED.last_seq),
          updated_at = now()
    RETURNING last_seq INTO v_last;
  ELSE
    SELECT last_seq INTO v_last FROM public.mode_counters WHERE year = p_year AND mode = p_mode;
    v_last := coalesce(v_last, 0);
  END IF;

  RETURN v_last;
END;
$$;
REVOKE ALL ON FUNCTION public.commit_document(text, integer, integer, text, text, numeric, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_document(text, integer, integer, text, text, numeric, jsonb, boolean) TO anon, authenticated, service_role;