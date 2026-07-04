import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createAgencyLead } from "@/lib/trips.functions";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  Handshake,
  ExternalLink,
  Mail,
  Phone,
  Globe,
  Sparkles,
  CalendarClock,
} from "lucide-react";

export type MatchedTour = {
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
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_website?: string | null;
};

export type TourMatchResponse = {
  exact: MatchedTour[];
  recommended: MatchedTour[];
};

type Contact = {
  id: string;
  agency_name: string;
  title: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_website: string | null;
  booking_url: string | null;
};

export function MatchingToursCard({
  matches,
  loading,
  tripId,
  destination,
}: {
  matches: TourMatchResponse | null;
  loading?: boolean;
  tripId?: string;
  destination?: string;
}) {
  const connect = useServerFn(createAgencyLead);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, Contact>>({});

  const exactTours = matches?.exact ?? [];
  const recommendedTours = matches?.recommended ?? [];
  const hasExact = exactTours.length > 0;
  const hasRecommended = recommendedTours.length > 0;
  const hasAnyTours = hasExact || hasRecommended;


  const onConnect = async (tour: MatchedTour) => {
    setBusyId(tour.id);
    try {
      const res = (await connect({
        data: {
          tourId: tour.id,
          tripId,
          message: destination
            ? `Interested in joining ${tour.agency_name} for ${destination}.`
            : undefined,
        },
      })) as { contact: Contact };
      setRevealed((r) => ({ ...r, [tour.id]: res.contact }));
      toast.success(`Request sent to ${tour.agency_name} 🤝`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send request");
    } finally {
      setBusyId(null);
    }
  };

  const renderTourList = (items: MatchedTour[]) => (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((t) => {
        const contact = revealed[t.id];
        return (
          <li
            key={t.id}
            className="rounded-xl border bg-background/60 p-3 flex flex-col gap-3"
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-primary">
                {t.agency_name}
              </div>
              <div className="font-medium text-sm mt-0.5 line-clamp-2">{t.title}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3" />
                {t.start_date} → {t.end_date}
                {t.price ? ` · ${t.currency} ${t.price}` : ""}
              </div>
              {t.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {contact ? (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-xs space-y-1">
                <div className="font-medium text-primary flex items-center gap-1">
                  <Handshake className="size-3" /> Contact details revealed
                </div>
                {contact.contact_email && (
                  <a
                    href={`mailto:${contact.contact_email}`}
                    className="flex items-center gap-1 hover:underline"
                  >
                    <Mail className="size-3" /> {contact.contact_email}
                  </a>
                )}
                {contact.contact_phone && (
                  <a
                    href={`tel:${contact.contact_phone}`}
                    className="flex items-center gap-1 hover:underline"
                  >
                    <Phone className="size-3" /> {contact.contact_phone}
                  </a>
                )}
                {contact.contact_website && (
                  <a
                    href={contact.contact_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:underline"
                  >
                    <Globe className="size-3" /> Website
                  </a>
                )}
                {!contact.contact_email &&
                  !contact.contact_phone &&
                  !contact.contact_website &&
                  contact.booking_url && (
                    <a
                      href={contact.booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:underline"
                    >
                      <ExternalLink className="size-3" /> Booking page
                    </a>
                  )}
              </div>
            ) : (
              <button
                onClick={() => onConnect(t)}
                disabled={busyId === t.id}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {busyId === t.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Handshake className="size-4" />
                )}
                Connect with Agency
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-4" />
        </span>
        <div>
          <div className="font-semibold text-sm md:text-base">
            {hasExact ? "Matching Group Tours Found!" : "Matching Group Tours"}
          </div>
          <div className="text-xs text-muted-foreground">
            Verified partner agencies with overlapping departure dates
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="size-4 animate-spin" /> Searching partner agencies…
        </div>
      )}

      {!loading && matches && !hasAnyTours && (
        <div className="rounded-xl border border-dashed bg-background/40 p-4 text-sm text-muted-foreground text-center">
          <Sparkles className="size-5 mx-auto mb-2 text-primary/70" />
          No group departures found for these exact dates yet. We&apos;ll notify you if
          an agency lists one!
        </div>
      )}

      {!loading && hasExact && renderTourList(exactTours)}

      {!loading && !hasExact && hasRecommended && (
        <div className="space-y-3">
          <div>
            <div className="font-semibold text-sm">Recommended Tours Near Your Dates</div>
            <div className="text-xs text-muted-foreground">
              Same destination, departing within a 7-day window.
            </div>
          </div>
          {renderTourList(recommendedTours)}
        </div>
      )}
    </div>
  );
}
