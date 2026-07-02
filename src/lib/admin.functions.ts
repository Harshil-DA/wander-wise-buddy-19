import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SAMPLE_TOURS = [
  {
    agency_name: "Wanderlust Group Tours",
    title: "Bali Beaches & Temples — Group Escape",
    destination: "Bali, Indonesia",
    description: "10-day curated group tour across Ubud, Seminyak & Nusa islands.",
    start_date: "2026-10-10",
    end_date: "2026-10-20",
    duration_days: 10,
    price: 1499,
    currency: "USD",
    difficulty: "easy",
    booking_url: "https://example.com/wanderlust/bali",
    contact_email: "hello@wanderlusttours.example",
    contact_phone: "+1-555-0100",
    contact_website: "https://wanderlusttours.example",
    tags: ["beach", "culture", "group"],
  },
  {
    agency_name: "EuroVibe Adventures",
    title: "Paris Winter Wonderland",
    destination: "Paris, France",
    description: "Festive 10-day Paris experience with day trips to Versailles.",
    start_date: "2026-12-20",
    end_date: "2026-12-30",
    duration_days: 10,
    price: 2199,
    currency: "USD",
    difficulty: "easy",
    booking_url: "https://example.com/eurovibe/paris",
    contact_email: "book@eurovibe.example",
    contact_phone: "+33-1-2345-6789",
    contact_website: "https://eurovibe.example",
    tags: ["city", "holiday", "romantic"],
  },
  {
    agency_name: "Zenith Expeditions",
    title: "Tokyo Autumn Discovery",
    destination: "Tokyo, Japan",
    description: "10-day journey through Tokyo, Hakone & Kyoto in peak fall colors.",
    start_date: "2026-11-05",
    end_date: "2026-11-15",
    duration_days: 10,
    price: 2599,
    currency: "USD",
    difficulty: "easy",
    booking_url: "https://example.com/zenith/tokyo",
    contact_email: "trips@zenithexp.example",
    contact_phone: "+81-3-1234-5678",
    contact_website: "https://zenithexp.example",
    tags: ["city", "culture", "autumn"],
  },
];

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { isAdmin: !!data, userId: context.userId };
  });

/**
 * Bootstrap: grants admin role to the current user IF no admin exists yet.
 * Safe one-time claim so the first signed-in user can access the testing panel.
 */
export const claimAdminIfNone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("An admin already exists.");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedSampleTours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("agency_tours")
      .insert(SAMPLE_TOURS)
      .select("id, agency_name, destination, start_date, end_date");
    if (error) throw new Error(error.message);
    return { inserted: data ?? [] };
  });

export const listAllTours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("agency_tours")
      .select("id, agency_name, title, destination, start_date, end_date, price, currency")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
