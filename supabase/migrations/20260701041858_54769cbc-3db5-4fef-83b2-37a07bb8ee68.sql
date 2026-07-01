
-- Add contact fields to agency_tours so we can reveal them after a lead is captured
ALTER TABLE public.agency_tours
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_website TEXT;

-- Lead capture table: logs a user's interest in an agency tour
CREATE TABLE IF NOT EXISTS public.agency_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES public.agency_tours(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_leads_user_idx ON public.agency_leads(user_id);
CREATE INDEX IF NOT EXISTS agency_leads_tour_idx ON public.agency_leads(tour_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_leads TO authenticated;
GRANT ALL ON public.agency_leads TO service_role;

ALTER TABLE public.agency_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads"
  ON public.agency_leads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own leads"
  ON public.agency_leads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
  ON public.agency_leads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all leads"
  ON public.agency_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER agency_leads_touch_updated_at
  BEFORE UPDATE ON public.agency_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
