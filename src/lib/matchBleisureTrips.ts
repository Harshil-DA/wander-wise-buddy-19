import type { BleisureRequest } from "@/components/bleisure/BleisureIntake";

export type BleisureCandidateTrip = {
  id: string;
  destination: string;
  budget: number | null;
  currency?: string | null;
  near_business_hubs: string[] | null;
  flex_min_days: number | null;
  flex_max_days: number | null;
  flex_compressible: boolean | null;
  [key: string]: unknown;
};

const TIGHT_RANGE_DAYS = 2;

function normalizeCity(s: string) {
  return s.trim().toLowerCase();
}

/**
 * Filters trips against a bleisure request:
 *  - near_business_hubs contains the business trip city (case-insensitive)
 *  - flex_min_days <= extraDays requested
 *  - trip budget <= leisure budget
 *  - if flex_compressible is false, the flex window must be tight
 *    (flex_max_days - flex_min_days <= TIGHT_RANGE_DAYS)
 *
 * Preserves the input order, which mirrors how trips are ranked upstream
 * (listTrips returns them ordered by created_at desc).
 */
export function matchBleisureTrips<T extends BleisureCandidateTrip>(
  bleisureRequest: Pick<
    BleisureRequest,
    "businessCity" | "extraDays" | "leisureBudgetUsd"
  >,
  trips: T[],
): T[] {
  const city = normalizeCity(bleisureRequest.businessCity);
  if (!city) return [];

  return trips.filter((trip) => {
    const hubs = (trip.near_business_hubs ?? []).map(normalizeCity);
    if (!hubs.includes(city)) return false;

    const flexMin = trip.flex_min_days;
    if (flexMin == null || flexMin > bleisureRequest.extraDays) return false;

    if (trip.budget != null && Number(trip.budget) > bleisureRequest.leisureBudgetUsd) {
      return false;
    }

    if (trip.flex_compressible === false) {
      const flexMax = trip.flex_max_days;
      if (flexMax == null) return false;
      if (flexMax - flexMin > TIGHT_RANGE_DAYS) return false;
    }

    return true;
  });
}
