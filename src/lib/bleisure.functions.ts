import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const bleisureSchema = z.object({
  businessCity: z.string().trim().min(1).max(100),
  fixedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fixedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  companyCoversAccommodation: z.boolean(),
  extraDays: z.number().int().min(0).max(60),
  extraDaysPlacement: z.enum(["before", "after", "both"]),
  leisureBudgetUsd: z.number().min(0).max(1_000_000),
  travelStyle: z.enum(["relax", "adventure", "culture_food", "mix"]),
  withSomeone: z.boolean(),
});

export type BleisureRequestInput = z.infer<typeof bleisureSchema>;

export const saveBleisureRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => bleisureSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (data.fixedEndDate < data.fixedStartDate) {
      throw new Error("End date must be on or after start date");
    }
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("bleisure_requests")
      .insert({
        user_id: userId,
        business_city: data.businessCity,
        fixed_start_date: data.fixedStartDate,
        fixed_end_date: data.fixedEndDate,
        company_covers_accommodation: data.companyCoversAccommodation,
        extra_days: data.extraDays,
        extra_days_placement: data.extraDaysPlacement,
        leisure_budget_usd: data.leisureBudgetUsd,
        travel_style: data.travelStyle,
        with_someone: data.withSomeone,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, createdAt: row.created_at };
  });

export const listBleisureRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("bleisure_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
