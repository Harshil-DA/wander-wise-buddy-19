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

const DAY_MS = 24 * 60 * 60 * 1000;

const DESTINATION_STOPWORDS = new Set([
  "and",
  "the",
  "city",
  "trip",
  "tour",
  "vacation",
  "holiday",
  "region",
  "state",
  "province",
  "country",
]);

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function cleanUtcDate(year: number, monthIndex: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(Date.UTC(year, monthIndex, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function normalizeYear(year: string | number | undefined, fallbackYear: number) {
  if (year == null || year === "") return fallbackYear;
  const y = Number(year);
  return y < 100 ? y + 2000 : y;
}

// Converts DB/user date strings into UTC-midnight Date objects before comparison.
// Handles ISO dates, numeric dates, and casual strings like "Oct 12" / "12 Oct 2026".
function parseCleanDate(input?: string | null, fallbackYear = new Date().getUTCFullYear()): Date | null {
  if (!input) return null;
  const s = String(input)
    .trim()
    .replace(/(\d)(st|nd|rd|th)\b/gi, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
  if (!s) return null;

  let match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return cleanUtcDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  match = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = normalizeYear(match[3], fallbackYear);
    // If unambiguous, treat 20/10 as D/M. Otherwise default to M/D for casual entries like 10/12.
    const month = first > 12 ? second - 1 : first - 1;
    const day = first > 12 ? first : second;
    return cleanUtcDate(year, month, day);
  }

  match = s.match(/^([a-zA-Z]+)\.?\s+(\d{1,2})(?:\s+(\d{2,4}))?$/);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    if (month != null) return cleanUtcDate(normalizeYear(match[3], fallbackYear), month, Number(match[2]));
  }

  match = s.match(/^(\d{1,2})\s+([a-zA-Z]+)\.?(?:\s+(\d{2,4}))?$/);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month != null) return cleanUtcDate(normalizeYear(match[3], fallbackYear), month, Number(match[1]));
  }

  const fallback = new Date(/\b\d{4}\b/.test(s) ? s : `${s} ${fallbackYear}`);
  if (Number.isNaN(fallback.getTime())) return null;
  return cleanUtcDate(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

function normalizeDateRange(start: Date | null, end: Date | null) {
  if (!start || !end) return { start, end };
  if (end.getTime() >= start.getTime()) return { start, end };
  const adjustedEnd = new Date(end.getTime());
  adjustedEnd.setUTCFullYear(adjustedEnd.getUTCFullYear() + 1);
  return { start, end: adjustedEnd };
}

function dateOverlaps(userStart: Date, userEnd: Date, agencyStart: Date, agencyEnd: Date) {
  return userStart.getTime() <= agencyEnd.getTime() && userEnd.getTime() >= agencyStart.getTime();
}

function tokenizeDestination(destination: string) {
  return destination
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 2 && !DESTINATION_STOPWORDS.has(token));
}

function destinationMatches(userDestination: string, agencyDestination: string | null) {
  if (!agencyDestination) return false;
  const userTokens = tokenizeDestination(userDestination);
  const agencyTokens = tokenizeDestination(agencyDestination);
  const normalizedUser = userTokens.join(" ");
  const normalizedAgency = agencyTokens.join(" ");

  if (!userTokens.length || !agencyTokens.length) {
    return userDestination.trim().toLowerCase() === agencyDestination.trim().toLowerCase();
  }

  return (
    userTokens.some((token) => agencyTokens.includes(token) || normalizedAgency.includes(token)) ||
    agencyTokens.some((token) => normalizedUser.includes(token))
  );
}

function movePastUserRangeToFuture(start: Date | null, end: Date | null) {
  if (!start || !end) return { start, end, shiftedYears: 0 };
  const today = cleanUtcDate(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  )!;
  const shiftedStart = new Date(start.getTime());
  const shiftedEnd = new Date(end.getTime());
  let shiftedYears = 0;

  while (shiftedEnd.getTime() < today.getTime() && shiftedYears < 10) {
    shiftedStart.setUTCFullYear(shiftedStart.getUTCFullYear() + 1);
    shiftedEnd.setUTCFullYear(shiftedEnd.getUTCFullYear() + 1);
    shiftedYears += 1;
  }

  return { start: shiftedStart, end: shiftedEnd, shiftedYears };
}

function uniqueTours<T extends { agency_name: string; title: string; destination: string; start_date: string; end_date: string }>(
  tours: T[],
) {
  const seen = new Set<string>();
  return tours.filter((tour) => {
    const key = [tour.agency_name, tour.title, tour.destination, tour.start_date, tour.end_date]
      .map((part) => part.toLowerCase())
      .join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const findMatchingTours = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => matchInput.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const destinationTokens = tokenizeDestination(data.destination);

    const { data: allRows, error } = await supabase
      .from("agency_tours")
      .select(
        "id, agency_name, title, destination, description, start_date, end_date, duration_days, price, currency, difficulty, booking_url, tags, contact_email, contact_phone, contact_website",
      )
      .order("start_date", { ascending: true })
      .limit(250);

    if (error) throw new Error(error.message);

    const rows = (allRows ?? []).filter((tour) => destinationMatches(data.destination, tour.destination));


    const parsedTripStart = parseCleanDate(data.startDate);
    const parsedTripEnd = parseCleanDate(
      data.endDate ?? data.startDate,
      parsedTripStart?.getUTCFullYear(),
    );
    const normalizedTripRange = normalizeDateRange(
      parsedTripStart,
      parsedTripEnd,
    );
    const {
      start: tripStart,
      end: tripEnd,
    } = movePastUserRangeToFuture(normalizedTripRange.start, normalizedTripRange.end);

    if (!tripStart || !tripEnd) {
      return { exact: [], recommended: uniqueTours(rows).slice(0, 10) };
    }


    const exact: typeof rows = [];
    const recommended: typeof rows = [];
    const windowStart = new Date(tripStart.getTime() - 7 * DAY_MS);
    const windowEnd = new Date(tripEnd.getTime() + 7 * DAY_MS);

    for (const tour of rows ?? []) {
      const parsedAgencyStart = parseCleanDate(tour.start_date, tripStart.getUTCFullYear());
      const parsedAgencyEnd = parseCleanDate(
        tour.end_date,
        parsedAgencyStart?.getUTCFullYear() ?? tripStart.getUTCFullYear(),
      );
      const { start: agencyStart, end: agencyEnd } = normalizeDateRange(
        parsedAgencyStart,
        parsedAgencyEnd,
      );

      if (!agencyStart || !agencyEnd) {
        continue;
      }


      const isExact = dateOverlaps(tripStart, tripEnd, agencyStart, agencyEnd);
      const isNear = !isExact && dateOverlaps(windowStart, windowEnd, agencyStart, agencyEnd);
      console.log("[findMatchingTours] compare:", {
        agency: tour.agency_name,
        userStart: tripStart.toISOString().slice(0, 10),
        userEnd: tripEnd.toISOString().slice(0, 10),
        agencyStart: agencyStart.toISOString().slice(0, 10),
        agencyEnd: agencyEnd.toISOString().slice(0, 10),
        exactOverlap: isExact,
        withinSevenDayWindow: isNear,
      });

      if (isExact) exact.push(tour);
      else if (isNear) recommended.push(tour);
    }

    console.log("[findMatchingTours] returning:", {
      exact: exact.length,
      recommended: exact.length === 0 ? recommended.length : 0,
    });
    return {
      exact: uniqueTours(exact).slice(0, 10),
      recommended: exact.length === 0 ? uniqueTours(recommended).slice(0, 10) : [],
    };
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

