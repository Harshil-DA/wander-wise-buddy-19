
-- =========================================================
-- 1. PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- 2. ROLES (admin etc.)
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 3. TRIPS (user-saved searches / itineraries)
-- =========================================================
CREATE TABLE public.trips (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_thread_id UUID REFERENCES public.threads(id) ON DELETE SET NULL,
  destination TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  trip_type TEXT,
  notes TEXT,
  itinerary_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX trips_user_id_idx ON public.trips (user_id);
CREATE INDEX trips_dates_idx ON public.trips (start_date, end_date);
CREATE INDEX trips_destination_idx ON public.trips (lower(destination));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trips"
  ON public.trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trips"
  ON public.trips FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trips_touch_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 4. AGENCY TOURS (partner trips, public read / admin write)
-- =========================================================
CREATE TABLE public.agency_tours (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name TEXT NOT NULL,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INTEGER,
  price NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  difficulty TEXT,
  booking_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agency_tours_dates_idx ON public.agency_tours (start_date, end_date);
CREATE INDEX agency_tours_destination_idx ON public.agency_tours (lower(destination));

GRANT SELECT ON public.agency_tours TO anon;
GRANT SELECT ON public.agency_tours TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.agency_tours TO authenticated;
GRANT ALL ON public.agency_tours TO service_role;

ALTER TABLE public.agency_tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read agency tours"
  ON public.agency_tours FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert agency tours"
  ON public.agency_tours FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update agency tours"
  ON public.agency_tours FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete agency tours"
  ON public.agency_tours FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER agency_tours_touch_updated_at
  BEFORE UPDATE ON public.agency_tours
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed a handful of sample partner tours so matching has something to show
INSERT INTO public.agency_tours
  (agency_name, title, destination, description, start_date, end_date, duration_days, price, currency, difficulty, booking_url, tags)
VALUES
  ('Indiahikes', 'Kedarkantha Winter Trek', 'Uttarakhand, India', 'Classic snow trek with summit views of Himalayan peaks.', (CURRENT_DATE + 14), (CURRENT_DATE + 20), 6, 11500, 'INR', 'Moderate', 'https://indiahikes.com/kedarkantha', ARRAY['trek','snow','himalayas']),
  ('Treksaathi', 'Hampta Pass Crossover', 'Himachal Pradesh, India', 'Dramatic crossover trek from lush Kullu to barren Lahaul.', (CURRENT_DATE + 21), (CURRENT_DATE + 26), 5, 9800, 'INR', 'Moderate', 'https://treksaathi.com/hampta-pass', ARRAY['trek','himalayas','crossover']),
  ('Thrillophilia', 'Bali Beach & Culture Escape', 'Bali, Indonesia', 'Beaches, temples, Ubud rice terraces and Seminyak nightlife.', (CURRENT_DATE + 30), (CURRENT_DATE + 36), 6, 850, 'USD', 'Easy', 'https://thrillophilia.com/bali', ARRAY['beach','culture','relaxed']),
  ('GetYourGuide', 'Iceland Ring Road Self-Drive', 'Iceland', '7-day curated self-drive loop with waterfalls, glaciers and the Blue Lagoon.', (CURRENT_DATE + 45), (CURRENT_DATE + 52), 7, 1900, 'USD', 'Easy', 'https://getyourguide.com/iceland-ring-road', ARRAY['road-trip','nature','self-drive']),
  ('Tripoto', 'Kyoto Cherry Blossom Week', 'Kyoto, Japan', 'Temples, tea houses and hanami picnics during peak sakura.', (CURRENT_DATE + 60), (CURRENT_DATE + 66), 6, 1700, 'USD', 'Easy', 'https://tripoto.com/kyoto-sakura', ARRAY['culture','spring','foodie']);
