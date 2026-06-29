import { createFileRoute } from "@tanstack/react-router";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: () => (
    <div className="flex-1 flex items-center justify-center text-center p-8">
      <div>
        <img src={logo} alt="" width={96} height={96} className="mx-auto mb-4" />
        <p className="text-muted-foreground">Setting up your first trip...</p>
      </div>
    </div>
  ),
});
