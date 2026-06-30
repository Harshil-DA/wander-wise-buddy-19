import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveTrip, findMatchingTours } from "@/lib/trips.functions";
import { toast } from "sonner";
import { Loader2, Save, Sparkles, ExternalLink } from "lucide-react";

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

type Tour = {
  id: string;
  agency_name: string;
  title: string;
  destination: string;
  description: string | null;
  start_date: string;
  end_date: string;
  duration_days: number | null;
  price: number | null;
  currency: string;
  difficulty: string | null;
  booking_url: string | null;
  tags: string[];
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
  const [tours, setTours] = useState<Tour[] | null>(null);

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
      await save({
        data: {
          threadId,
          destination,
          startDate,
          endDate,
          budget,
          currency: "USD",
          itinerary,
        },
      });
      setSaved(true);
      toast.success("Trip saved! 🧳");
      const matched = (await match({ data: { destination, startDate, endDate } })) as Tour[];
      setTours(matched);
      if (matched.length === 0) toast.message("No partner tours overlap these dates (yet).");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save trip");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border bg-card p-4">
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

      {tours && tours.length > 0 && (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            🤝 Partner tours overlapping your dates
          </div>
          <ul className="space-y-2">
            {tours.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border bg-background/60 p-3 text-sm flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.agency_name} · {t.destination} · {t.start_date} → {t.end_date}
                    {t.price ? ` · ${t.currency} ${t.price}` : ""}
                    {t.difficulty ? ` · ${t.difficulty}` : ""}
                  </div>
                </div>
                {t.booking_url && (
                  <a
                    href={t.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-primary hover:underline text-xs"
                  >
                    Book <ExternalLink className="size-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
