import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTrips, findMatchingTours } from "@/lib/trips.functions";
import { MatchingToursCard, type MatchedTour } from "@/components/trips/MatchingToursCard";
import { CalendarClock, MapPin, Wallet, Loader2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trips")({
  head: () => ({
    meta: [
      { title: "My trips — Wanderly" },
      { name: "description", content: "Your saved trips and matching partner tours." },
    ],
  }),
  component: TripsDashboard,
});

type Trip = {
  id: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  currency: string;
  trip_type: string | null;
  notes: string | null;
  itinerary_json: unknown;
  created_at: string;
};

function TripsDashboard() {
  const list = useServerFn(listTrips);
  const trips = useQuery({ queryKey: ["trips"], queryFn: () => list() });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My trips</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every itinerary you&apos;ve saved — tap one to see matching group departures.
          </p>
        </header>

        {trips.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading trips…
          </div>
        )}

        {trips.data && trips.data.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            You haven&apos;t saved any trips yet. Plan one in chat and hit
            &ldquo;Save trip&rdquo;.
          </div>
        )}

        {trips.data && trips.data.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {(trips.data as Trip[]).map((t) => {
              const active = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(active ? null : t.id)}
                  className={`text-left rounded-2xl border p-4 transition ${
                    active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        <MapPin className="size-4 text-primary" />
                        <span className="truncate">{t.destination}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="size-3" />
                        {t.start_date ?? "?"} → {t.end_date ?? "?"}
                      </div>
                      {t.budget != null && (
                        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <Wallet className="size-3" /> {t.currency} {Number(t.budget).toFixed(0)}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide rounded-full bg-primary/10 text-primary px-2 py-1">
                      <Users className="size-3" /> Match
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedId && (
          <TripMatches
            trip={(trips.data as Trip[] | undefined)?.find((t) => t.id === selectedId)}
          />
        )}
      </div>
    </div>
  );
}

function TripMatches({ trip }: { trip: Trip | undefined }) {
  const match = useServerFn(findMatchingTours);
  const matchesQ = useQuery({
    queryKey: ["trip-matches", trip?.id],
    enabled: !!trip,
    queryFn: () =>
      match({
        data: {
          destination: trip!.destination,
          startDate: trip!.start_date ?? undefined,
          endDate: trip!.end_date ?? undefined,
        },
      }) as Promise<MatchedTour[]>,
  });

  if (!trip) return null;

  return (
    <MatchingToursCard
      tours={matchesQ.data ?? null}
      loading={matchesQ.isLoading}
      tripId={trip.id}
      destination={trip.destination}
    />
  );
}
