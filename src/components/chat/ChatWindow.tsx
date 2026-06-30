import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMessages, renameThread } from "@/lib/trips.functions";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { SaveTripPanel } from "./SaveTripPanel";
import { toast } from "sonner";

const SUGGESTIONS = [
  "🏖️ Plan a 5-day beach trip to Bali under $1500",
  "🥾 4-day trek in the Himalayas in October",
  "🏛️ Cultural week in Kyoto for 2 in spring",
  "🚗 7-day road trip across Iceland",
];

export function ChatWindow({ threadId }: { threadId: string }) {
  const qc = useQueryClient();
  const getMsgs = useServerFn(getMessages);
  const rename = useServerFn(renameThread);

  const initialQ = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => getMsgs({ data: { threadId } }),
  });

  const initialMessages: UIMessage[] = (initialQ.data ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.parts as UIMessage["parts"],
  }));

  if (initialQ.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ChatInner
      key={threadId}
      threadId={threadId}
      initialMessages={initialMessages}
      rename={rename}
      qc={qc}
    />
  );
}

function ChatInner({
  threadId,
  initialMessages,
  rename,
  qc,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  rename: ReturnType<typeof useServerFn<typeof renameThread>>;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId },
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(input, { ...init, headers });
        },
      }),
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });

  useEffect(() => {
    if (error) toast.error(error.message ?? "Something went wrong");
  }, [error]);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const isBusy = status === "submitted" || status === "streaming";

  const submit = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isBusy) return;
    setInput("");
    // Rename on first message
    if (messages.length === 0) {
      const title = text.length > 60 ? text.slice(0, 57) + "..." : text;
      rename({ data: { id: threadId, title } })
        .then(() => qc.invalidateQueries({ queryKey: ["threads"] }))
        .catch(() => {});
    }
    await sendMessage({ text });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center pt-10">
              <img src={logo} alt="" width={84} height={84} className="mx-auto mb-3" />
              <h2 className="text-2xl font-bold">Hey, where to next? 🌎</h2>
              <p className="text-muted-foreground mt-1">
                I'll plan your itinerary, budget, packing list & local phrases.
              </p>
              <div className="grid sm:grid-cols-2 gap-2 mt-6 max-w-xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="text-left text-sm px-4 py-3 rounded-xl border bg-card hover:bg-secondary transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            return (
              <div key={m.id}>
                <MessageBubble message={m} />
                {m.role === "assistant" && isLast && status !== "streaming" && (
                  <SaveTripPanel threadId={threadId} assistantText={text} />
                )}
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Wanderly is thinking...
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t bg-background p-3"
      >
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Tell me about your dream trip..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-40"
            disabled={isBusy}
          />
          <button
            type="submit"
            disabled={isBusy || !input.trim()}
            className="size-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition shrink-0"
            aria-label="Send"
          >
            {isBusy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <img src={logo} alt="" width={32} height={32} className="size-8 shrink-0 mt-1" />
      <div className="md-body flex-1 min-w-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || "..."}</ReactMarkdown>
      </div>
    </div>
  );
}
