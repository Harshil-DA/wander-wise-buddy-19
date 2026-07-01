import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id, title, updated_at, created_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ title: z.string().min(1).max(120).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("threads")
      .insert({
        user_id: context.userId,
        title: data.title ?? "New trip ✈️",
      })
      .select("id, title, updated_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      role: r.role as "user" | "assistant" | "system",
      parts: (r.parts ?? []) as Array<{ type: string; text?: string }>,
    }));
  });

export const saveUserMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        text: z.string().min(1).max(8000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: context.userId,
      role: "user",
      parts: [{ type: "text", text: data.text }],
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Saved trips & partner-tour matching ----------

const itinerarySchema = z.object({
  days: z
    .array(
      z.object({
        day: z.number().optional(),
        date: z.string().optional(),
        location: z.string().optional(),
        activities: z
          .array(
            z.object({
              time: z.string().optional(),
              activity: z.string(),
              estimated_cost_usd: z.number().optional(),
              geocoordinates: z
                .object({ lat: z.number(), lng: z.number() })
                .optional(),
            }),
          )
          .default([]),
      }),
    )
    .min(1),
});

const saveTripInput = z.object({
  threadId: z.string().uuid().optional(),
  destination: z.string().min(1).max(200),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().nonnegative().optional(),
  currency: z.string().min(1).max(8).default("USD"),
  tripType: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  itinerary: itinerarySchema.optional(),
});

export const saveTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveTripInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("trips")
      .insert({
        user_id: context.userId,
        source_thread_id: data.threadId ?? null,
        destination: data.destination,
        start_date: data.startDate ?? null,
        end_date: data.endDate ?? null,
        budget: data.budget ?? null,
        currency: data.currency,
        trip_type: data.tripType ?? null,
        notes: data.notes ?? null,
        itinerary_json: data.itinerary ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

const matchInput = z.object({
  destination: z.string().min(1).max(200),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const findMatchingTours = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => matchInput.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Fuzzy destination match on first significant word (e.g. "Bali, Indonesia" -> "bali")
    const token = data.destination
      .split(/[,\-\/]/)[0]
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2)[0];
    const needle = (token ?? data.destination).toLowerCase();

    let q = supabase
      .from("agency_tours")
      .select(
        "id, agency_name, title, destination, description, start_date, end_date, duration_days, price, currency, difficulty, booking_url, tags, contact_email, contact_phone, contact_website",
      )
      .ilike("destination", `%${needle}%`)
      .order("start_date", { ascending: true })
      .limit(10);

    if (data.startDate && data.endDate) {
      // Overlap: tour.start_date <= tripEnd AND tour.end_date >= tripStart
      q = q.lte("start_date", data.endDate).gte("end_date", data.startDate);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Dashboard: saved trips ----------

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trips")
      .select(
        "id, destination, start_date, end_date, budget, currency, trip_type, notes, itinerary_json, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Lead capture ----------

const leadInput = z.object({
  tourId: z.string().uuid(),
  tripId: z.string().uuid().optional(),
  message: z.string().max(1000).optional(),
});

export const createAgencyLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => leadInput.parse(d))
  .handler(async ({ context, data }) => {
    // Log the lead (RLS enforces user_id = auth.uid())
    const { data: lead, error } = await context.supabase
      .from("agency_leads")
      .insert({
        user_id: context.userId,
        tour_id: data.tourId,
        trip_id: data.tripId ?? null,
        message: data.message ?? null,
      })
      .select("id, status, created_at")
      .single();
    if (error) throw new Error(error.message);

    // Reveal agency contact details now that the lead is on record
    const { data: tour, error: tourErr } = await context.supabase
      .from("agency_tours")
      .select(
        "id, agency_name, title, contact_email, contact_phone, contact_website, booking_url",
      )
      .eq("id", data.tourId)
      .single();
    if (tourErr) throw new Error(tourErr.message);

    return { lead, contact: tour };
  });

