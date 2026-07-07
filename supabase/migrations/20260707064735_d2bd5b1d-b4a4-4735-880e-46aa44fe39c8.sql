ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS near_business_hubs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flex_min_days integer,
  ADD COLUMN IF NOT EXISTS flex_max_days integer,
  ADD COLUMN IF NOT EXISTS flex_compressible boolean NOT NULL DEFAULT false;