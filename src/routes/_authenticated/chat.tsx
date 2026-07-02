import { createFileRoute, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, LogOut, Compass, Luggage, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  listThreads,
  createThread,
  deleteThread,
} from "@/lib/trips.functions";
import logo from "@/assets/logo.png";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Plan your trip — Wanderly" },
      { name: "description", content: "Chat with Wanderly to plan your next trip." },
    ],
  }),
  component: ChatLayout,
});

function ChatLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const remove = useServerFn(deleteThread);

  const threadsQ = useQuery({
    queryKey: ["threads"],
    queryFn: () => list(),
  });

  const activeThreadId =
    (router.state.matches.at(-1)?.params as { threadId?: string } | undefined)?.threadId;

  // Auto-create or select a thread when landing on /chat
  useEffect(() => {
    if (activeThreadId) return;
    if (threadsQ.isLoading) return;
    const first = threadsQ.data?.[0];
    if (first) {
      navigate({ to: "/chat/$threadId", params: { threadId: first.id }, replace: true });
    } else if (threadsQ.data) {
      create({ data: {} }).then((t) => {
        if (t) {
          qc.invalidateQueries({ queryKey: ["threads"] });
          navigate({ to: "/chat/$threadId", params: { threadId: t.id }, replace: true });
        }
      });
    }
  }, [activeThreadId, threadsQ.data, threadsQ.isLoading, create, navigate, qc]);

  const newTrip = async () => {
    const t = await create({ data: {} });
    if (t) {
      await qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    }
  };

  const del = async (id: string) => {
    await remove({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["threads"] });
    if (id === activeThreadId) {
      navigate({ to: "/chat", replace: true });
    }
    toast.success("Trip deleted");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static z-40 inset-y-0 left-0 w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform`}
      >
        <div className="p-4 flex items-center gap-2 border-b border-sidebar-border">
          <img src={logo} alt="Wanderly" width={36} height={36} />
          <div>
            <h1 className="font-bold text-base leading-tight">Wanderly</h1>
            <p className="text-xs text-muted-foreground">Your trip buddy ✈️</p>
          </div>
        </div>
        <div className="p-3 space-y-2">
          <Button onClick={newTrip} className="w-full" size="sm">
            <Plus className="size-4" /> New trip
          </Button>
          <Link
            to="/trips"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-sidebar-accent/60"
          >
            <Luggage className="size-4" /> My trips
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {threadsQ.data?.map((t) => {
            const active = t.id === activeThreadId;
            return (
              <div
                key={t.id}
                className={`group flex items-center rounded-lg ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"
                }`}
              >
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: t.id }}
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 px-3 py-2 text-sm truncate"
                >
                  <span className="inline-flex items-center gap-2">
                    <Compass className="size-3.5 opacity-70" />
                    <span className="truncate">{t.title}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label="Delete trip"
                  onClick={() => del(t.id)}
                  className="opacity-0 group-hover:opacity-100 px-2 py-2 text-muted-foreground hover:text-destructive transition"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
          {threadsQ.data?.length === 0 && (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">
              No trips yet. Start a new one! 🌍
            </p>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-2 p-3 border-b">
          <Button size="sm" variant="ghost" onClick={() => setMobileOpen(true)}>
            ☰
          </Button>
          <span className="font-semibold">Wanderly</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
