import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { TRIP_PLANNER_SYSTEM_PROMPT } from "@/lib/system-prompt";

type ChatRequestBody = { messages?: unknown; threadId?: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, threadId } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace(/^Bearer\s+/i, "");
        if (!token || token.split(".").length !== 3) {
          return new Response("Unauthorized", { status: 401 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: TRIP_PLANNER_SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
          onFinish: async ({ messages: finalMessages }) => {
            if (!threadId) return;
            try {
              const SUPABASE_URL = process.env.SUPABASE_URL;
              const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
              if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return;
              const { createClient } = await import("@supabase/supabase-js");
              const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                global: { headers: { Authorization: `Bearer ${token}` } },
                auth: { persistSession: false, autoRefreshToken: false },
              });
              const { data: claimsData } = await supabase.auth.getClaims(token);
              const userId = claimsData?.claims?.sub;
              if (!userId) return;

              // Only persist the new messages (last user + assistant)
              const lastTwo = (finalMessages as UIMessage[]).slice(-2);
              const rows = lastTwo.map((m) => ({
                thread_id: threadId,
                user_id: userId,
                role: m.role,
                parts: m.parts as unknown,
              }));
              if (rows.length) {
                await supabase.from("messages").insert(rows);
                await supabase
                  .from("threads")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", threadId);
              }
            } catch (err) {
              console.error("Failed to persist messages", err);
            }
          },
        });
      },
    },
  },
});
