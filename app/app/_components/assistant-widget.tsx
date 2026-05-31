"use client";

import { useState, useRef, useEffect } from "react";
import { askAssistant, runAssistantAction } from "../assistant/actions";

type ProposedAction = {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
};
type Msg = {
  role: "user" | "assistant";
  text: string;
  action?: ProposedAction;
  state?: "pending" | "running" | "done" | "cancelled";
  result?: string;
};

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    const next: Msg[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const res = await askAssistant(
      q,
      next
        .filter((m) => !m.action)
        .map((m) => ({ role: m.role, text: m.text }))
        .slice(-6)
    );
    setLoading(false);
    if (res.kind === "action") {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: res.text, action: res.action, state: "pending" },
      ]);
    } else {
      setMessages((m) => [...m, { role: "assistant", text: res.text }]);
    }
  }

  async function confirm(index: number) {
    const msg = messages[index];
    if (!msg || !msg.action) return;
    setMessages((m) =>
      m.map((x, i) => (i === index ? { ...x, state: "running" } : x))
    );
    const res = await runAssistantAction(msg.action);
    const ok = !("error" in res);
    const result = "error" in res ? res.error : res.message;
    setMessages((m) =>
      m.map((x, i) =>
        i === index ? { ...x, state: ok ? "done" : "pending", result } : x
      )
    );
  }

  function cancel(index: number) {
    setMessages((m) =>
      m.map((x, i) =>
        i === index ? { ...x, state: "cancelled", result: "Cancelled." } : x
      )
    );
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open assistant"
        className="fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-6 h-6">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4z" />
            <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm h-[70vh] max-h-[560px] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="font-semibold text-sm">Assistant</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Ask about your business, or tell me to do something — &quot;mark
                the Pearson trip paid&quot;, &quot;who owes me money?&quot;,
                &quot;add a customer named Maria&quot;.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "flex justify-end"
                    : "flex flex-col items-start"
                }
              >
                <div
                  className={
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap " +
                    (m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground")
                  }
                >
                  {m.text}
                </div>
                {m.action && (
                  <div className="mt-2 w-full">
                    {m.state === "pending" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirm(i)}
                          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => cancel(i)}
                          className="h-8 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {m.state === "running" && (
                      <div className="text-xs text-muted-foreground">Working...</div>
                    )}
                    {m.result && (
                      <div
                        className={
                          "text-sm mt-1 " +
                          (m.state === "done"
                            ? "text-emerald-600"
                            : m.state === "cancelled"
                            ? "text-muted-foreground"
                            : "text-destructive")
                        }
                      >
                        {m.result}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="mr-auto bg-secondary text-muted-foreground rounded-2xl px-3 py-2 text-sm">
                Thinking...
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                placeholder="Ask or tell me to do something..."
                className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-24"
              />
              <button
                type="button"
                onClick={send}
                disabled={loading || !input.trim()}
                className="h-9 w-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:opacity-90 transition-opacity"
                aria-label="Send"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}