CREATE TABLE public.bleisure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_city text NOT NULL,
  fixed_start_date date NOT NULL,
  fixed_end_date date NOT NULL,
  company_covers_accommodation boolean NOT NULL DEFAULT false,
  extra_days integer NOT NULL DEFAULT 0,
  extra_days_placement text NOT NULL DEFAULT 'after' CHECK (extra_days_placement IN ('before','after','both')),
  leisure_budget_usd numeric NOT NULL DEFAULT 0,
  travel_style text NOT NULL DEFAULT 'mix' CHECK (travel_style IN ('relax','adventure','culture_food','mix')),
  with_someone boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bleisure_requests TO authenticated;
GRANT ALL ON public.bleisure_requests TO service_role;

ALTER TABLE public.bleisure_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own bleisure requests"
  ON public.bleisure_requests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER bleisure_requests_touch_updated_at
  BEFORE UPDATE ON public.bleisure_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX bleisure_requests_user_created_idx
  ON public.bleisure_requests (user_id, created_at DESC);