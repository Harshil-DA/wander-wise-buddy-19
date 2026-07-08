import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BleisureIntake, type BleisureRequest } from "@/components/bleisure/BleisureIntake";
import { BleisureResults } from "@/components/bleisure/BleisureResults";
import { listTripsForBleisure } from "@/lib/trips.functions";
import {
  matchBleisureTrips,
  type BleisureCandidateTrip,
} from "@/lib/matchBleisureTrips";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bleisure")({
  head: () => ({
    meta: [
      { title: "Plan a bleisure trip — Wanderly" },
      {
        name: "description",
        content:
          "Turn your business trip into a bleisure getaway — matched to your city, budget and available extra days.",
      },
    ],
  }),
  component: BleisurePage,
});

function BleisurePage() {
  const fetchTrips = useServerFn(listTripsForBleisure);
  const [results, setResults] = useState<BleisureCandidateTrip[] | null>(null);
  const [running, setRunning] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (bleisureRequest: BleisureRequest) => {
    setRunning(true);
    try {
      const trips = (await fetchTrips()) as unknown as BleisureCandidateTrip[];
      const matched = matchBleisureTrips(bleisureRequest, trips);
      setResults(matched);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Plan a bleisure trip
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us about your business trip and we&apos;ll match leisure add-ons.
          </p>
        </header>

        {results === null ? (
          <BleisureIntake onSubmit={handleSubmit} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {running ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Matching…
                  </span>
                ) : (
                  <>
                    Found{" "}
                    <span className="font-semibold text-foreground">
                      {results.length}
                    </span>{" "}
                    matching {results.length === 1 ? "trip" : "trips"}
                  </>
                )}
              </div>
              <button
                onClick={() => setResults(null)}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Edit answers
              </button>
            </div>
            <BleisureResults
              trips={results}
              onSignUp={() => navigate({ to: "/auth" })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
