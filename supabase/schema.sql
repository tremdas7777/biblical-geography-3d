-- Biblical Geography 3D — analytics para Lovable Cloud / Supabase
-- Cole no SQL Editor do Supabase (ou peça ao Lovable: "run supabase/schema.sql")

CREATE TABLE IF NOT EXISTS bg3d_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  step TEXT,
  payload JSONB,
  lang TEXT,
  device TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bg3d_sessions (
  session_id TEXT PRIMARY KEY,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  lang TEXT,
  device TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  max_scroll INT DEFAULT 0,
  reached_preview BOOLEAN DEFAULT FALSE,
  reached_offer BOOLEAN DEFAULT FALSE,
  reached_checkout BOOLEAN DEFAULT FALSE,
  checkout_at TIMESTAMPTZ,
  current_section TEXT,
  page_views INT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_bg3d_events_created ON bg3d_events(created_at);
CREATE INDEX IF NOT EXISTS idx_bg3d_events_session ON bg3d_events(session_id);
CREATE INDEX IF NOT EXISTS idx_bg3d_sessions_last_seen ON bg3d_sessions(last_seen);
CREATE INDEX IF NOT EXISTS idx_bg3d_sessions_first_seen ON bg3d_sessions(first_seen);

CREATE OR REPLACE FUNCTION bg3d_upsert_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scroll INT := COALESCE((NEW.payload->>'scroll')::INT, 0);
  v_section TEXT := COALESCE(NEW.payload->>'section', NEW.step, 'landing');
  v_preview BOOLEAN := (NEW.step = 'preview' OR (NEW.event_type = 'section_view' AND NEW.step = 'preview'));
  v_offer BOOLEAN := (NEW.step = 'offer' OR (NEW.event_type = 'section_view' AND NEW.step = 'offer'));
  v_checkout BOOLEAN := (NEW.event_type = 'checkout_click');
BEGIN
  INSERT INTO bg3d_sessions (
    session_id, first_seen, last_seen, lang, device, referrer,
    utm_source, utm_medium, utm_campaign, max_scroll,
    reached_preview, reached_offer, reached_checkout, checkout_at,
    current_section, page_views
  ) VALUES (
    NEW.session_id, NEW.created_at, NEW.created_at, NEW.lang, NEW.device, NEW.referrer,
    NEW.utm_source, NEW.utm_medium, NEW.utm_campaign, v_scroll,
    v_preview, v_offer, v_checkout, CASE WHEN v_checkout THEN NEW.created_at END,
    v_section, CASE WHEN NEW.event_type = 'page_view' THEN 1 ELSE 0 END
  )
  ON CONFLICT (session_id) DO UPDATE SET
    last_seen = EXCLUDED.last_seen,
    lang = COALESCE(EXCLUDED.lang, bg3d_sessions.lang),
    device = COALESCE(EXCLUDED.device, bg3d_sessions.device),
    max_scroll = GREATEST(bg3d_sessions.max_scroll, EXCLUDED.max_scroll),
    reached_preview = bg3d_sessions.reached_preview OR EXCLUDED.reached_preview,
    reached_offer = bg3d_sessions.reached_offer OR EXCLUDED.reached_offer,
    reached_checkout = bg3d_sessions.reached_checkout OR EXCLUDED.reached_checkout,
    checkout_at = COALESCE(bg3d_sessions.checkout_at, EXCLUDED.checkout_at),
    current_section = COALESCE(EXCLUDED.current_section, bg3d_sessions.current_section),
    page_views = bg3d_sessions.page_views + EXCLUDED.page_views;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bg3d_upsert_session ON bg3d_events;
CREATE TRIGGER trg_bg3d_upsert_session
  AFTER INSERT ON bg3d_events
  FOR EACH ROW EXECUTE FUNCTION bg3d_upsert_session();

ALTER TABLE bg3d_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bg3d_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bg3d_events_anon_insert ON bg3d_events;
CREATE POLICY bg3d_events_anon_insert ON bg3d_events
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS bg3d_events_auth_select ON bg3d_events;
CREATE POLICY bg3d_events_auth_select ON bg3d_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS bg3d_sessions_auth_select ON bg3d_sessions;
CREATE POLICY bg3d_sessions_auth_select ON bg3d_sessions
  FOR SELECT TO authenticated USING (true);
