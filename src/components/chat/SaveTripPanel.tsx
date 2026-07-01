import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveTrip, findMatchingTours } from "@/lib/trips.functions";
import { toast } from "sonner";
import { Loader2, Save, Sparkles } from "lucide-react";
import { MatchingToursCard, type MatchedTour } from "@/components/trips/MatchingToursCard";

type Itinerary = {
  days: Array<{
    day?: number;
    date?: string;
    location?: string;
    activities: Array<{
      time?: string;
      activity: string;
      estimated_cost_usd?: number;
      geocoordinates?: { lat: number; lng: number };
    }>;
  }>;
};

function extractItinerary(text: string): Itinerary | null {
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && Array.isArray(parsed.days) && parsed.days.length) return parsed as Itinerary;
  } catch {
    /* ignore */
  }
  return null;
}

export function SaveTripPanel({
  threadId,
  assistantText,
}: {
  threadId: string;
  assistantText: string;
}) {
  const save = useServerFn(saveTrip);
  const match = useServerFn(findMatchingTours);

  const itinerary = useMemo(() => extractItinerary(assistantText), [assistantText]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tripId, setTripId] = useState<string | undefined>();
  const [tours, setTours] = useState<MatchedTour[] | null>(null);

  if (!itinerary) return null;

  const destination = itinerary.days[0]?.location?.trim() || "Unknown";
  const startDate = itinerary.days[0]?.date;
  const endDate = itinerary.days[itinerary.days.length - 1]?.date;
  const budget = itinerary.days.reduce(
    (sum, d) => sum + d.activities.reduce((s, a) => s + (a.estimated_cost_usd ?? 0), 0),
    0,
  );

  const onSave = async () => {
    setSaving(true);
    try {
      const { id } = (await save({
        data: {
          threadId,
          destination,
          startDate,
          endDate,
          budget,
          currency: "USD",
          itinerary,
        },
      })) as { id: string };
      setTripId(id);
      setSaved(true);
      toast.success("Trip saved! 🧳");
      const matched = (await match({
        data: { destination, startDate, endDate },
      })) as MatchedTour[];
      setTours(matched);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save trip");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <div className="font-semibold">📍 {destination}</div>
            <div className="text-muted-foreground">
              {startDate ?? "?"} → {endDate ?? "?"} · ~${budget.toFixed(0)} est.
            </div>
          </div>
          <button
            onClick={onSave}
            disabled={saving || saved}
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved ? (
              <Sparkles className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saved ? "Saved" : "Save trip & find partners"}
          </button>
        </div>
      </div>

      {(saving || tours) && (
        <MatchingToursCard
          tours={tours}
          loading={saving && !tours}
          tripId={tripId}
          destination={destination}
        />
      )}
    </div>
  );
}

