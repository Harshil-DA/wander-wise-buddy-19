import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Shield, Sparkles, Database } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  isAdmin,
  claimAdminIfNone,
  seedSampleTours,
  listAllTours,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Wanderly" },
      { name: "description", content: "Internal testing panel." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPanel,
});

type Tour = {
  id: string;
  agency_name: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  price: number | null;
  currency: string;
};

function AdminPanel() {
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isAdmin);
  const claim = useServerFn(claimAdminIfNone);
  const seed = useServerFn(seedSampleTours);
  const list = useServerFn(listAllTours);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });
  const toursQ = useQuery({
    queryKey: ["admin-tours"],
    queryFn: () => list() as Promise<Tour[]>,
    enabled: !!adminQ.data?.isAdmin,
  });

  const onClaim = async () => {
    try {
      await claim();
      toast.success("You are now the admin 🛡️");
      qc.invalidateQueries({ queryKey: ["is-admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't claim admin");
    }
  };

  const onSeed = async () => {
    try {
      const res = (await seed()) as { inserted: unknown[] };
      toast.success(`Seeded ${res.inserted.length} sample tours ✨`);
      qc.invalidateQueries({ queryKey: ["admin-tours"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't seed tours");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <header className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Admin & Testing Panel
            </h1>
            <p className="text-sm text-muted-foreground">
              Internal only — seed mock agency tours to test matchmaking.
            </p>
          </div>
        </header>

        {adminQ.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking access…
          </div>
        )}

        {adminQ.data && !adminQ.data.isAdmin && (
          <div className="rounded-2xl border border-dashed p-6 space-y-3">
            <p className="text-sm">
              You&apos;re signed in but don&apos;t have the <code>admin</code> role.
              If no admin exists yet, you can claim it:
            </p>
            <Button onClick={onClaim}>
              <Shield className="size-4" /> Claim admin (first user only)
            </Button>
          </div>
        )}

        {adminQ.data?.isAdmin && (
          <>
            <section className="rounded-2xl border p-5 space-y-4 bg-card">
              <div className="flex items-start gap-3">
                <Sparkles className="size-5 text-primary mt-0.5" />
                <div>
                  <h2 className="font-semibold">Seed 3 sample agency tours</h2>
                  <p className="text-sm text-muted-foreground">
                    Inserts Bali (Oct 10–20), Paris (Dec 20–30), Tokyo (Nov 5–15)
                    into <code>agency_tours</code> for matchmaking tests.
                  </p>
                </div>
              </div>
              <Button onClick={onSeed}>
                <Database className="size-4" /> Seed sample tours
              </Button>
            </section>

            <section className="rounded-2xl border p-5 bg-card">
              <h2 className="font-semibold mb-3">Recent agency tours</h2>
              {toursQ.isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              )}
              {toursQ.data && toursQ.data.length === 0 && (
                <p className="text-sm text-muted-foreground">No tours yet.</p>
              )}
              {toursQ.data && toursQ.data.length > 0 && (
                <ul className="divide-y">
                  {toursQ.data.map((t) => (
                    <li key={t.id} className="py-2 flex items-center justify-between text-sm gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.agency_name} · {t.destination}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {t.start_date} → {t.end_date}
                        {t.price != null && ` · ${t.currency} ${t.price}`}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
