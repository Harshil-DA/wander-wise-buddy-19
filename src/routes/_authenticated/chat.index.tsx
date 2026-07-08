import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: () => (
    <div className="flex-1 flex items-center justify-center text-center p-8">
      <div>
        <img src={logo} alt="" width={96} height={96} className="mx-auto mb-4" />
        <p className="text-muted-foreground">Setting up your first trip...</p>
        <Link
          to="/bleisure"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Briefcase className="size-4" />
          Plan a Bleisure Trip
        </Link>
      </div>
    </div>
  ),
});
