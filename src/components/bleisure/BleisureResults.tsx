import { Lock, MapPin, Wallet, CalendarClock, Sparkles } from "lucide-react";
import type { BleisureCandidateTrip } from "@/lib/matchBleisureTrips";

type Trip = BleisureCandidateTrip & {
  start_date?: string | null;
  end_date?: string | null;
  trip_type?: string | null;
  notes?: string | null;
  currency?: string | null;
};

export function BleisureResults({
  trips,
  onSignUp,
}: {
  trips: Trip[];
  onSignUp?: () => void;
}) {
  if (trips.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
        No matching bleisure trips yet. Try widening your extra days or budget.
      </div>
    );
  }

  const [first, ...rest] = trips;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" /> Top match
        </div>
        <TripCard trip={first} />
      </div>

      {rest.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {rest.length} more {rest.length === 1 ? "match" : "matches"}
          </div>
          {rest.map((t) => (
            <LockedTripCard key={t.id} trip={t} onSignUp={onSignUp} />
          ))}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            <MapPin className="size-4 text-primary" />
            <span className="truncate">{trip.destination}</span>
          </div>
          {(trip.start_date || trip.end_date) && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="size-3" />
              {trip.start_date ?? "?"} → {trip.end_date ?? "?"}
            </div>
          )}
          {trip.budget != null && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Wallet className="size-3" /> {trip.currency ?? "USD"}{" "}
              {Number(trip.budget).toFixed(0)}
            </div>
          )}
        </div>
        {trip.trip_type && (
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wide text-primary">
            {trip.trip_type}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Min days" value={trip.flex_min_days ?? "—"} />
        <Stat label="Max days" value={trip.flex_max_days ?? "—"} />
        <Stat
          label="Compressible"
          value={trip.flex_compressible ? "Yes" : "No"}
        />
      </div>

      {trip.notes && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
          {trip.notes}
        </p>
      )}

      {trip.near_business_hubs && trip.near_business_hubs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {trip.near_business_hubs.map((h) => (
            <span
              key={h}
              className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              near {h}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LockedTripCard({
  trip,
  onSignUp,
}: {
  trip: Trip;
  onSignUp?: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none select-none blur-sm"
        style={{ filter: "blur(6px)" }}
      >
        <TripCard trip={trip} />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-medium shadow-sm">
          <Lock className="size-3.5" /> Locked preview
        </div>
        <button
          onClick={onSignUp}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Sign up to unlock
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
