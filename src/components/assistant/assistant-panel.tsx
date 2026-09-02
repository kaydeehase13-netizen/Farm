"use client";

import { useState } from "react";
import { Sparkles, X, Send } from "lucide-react";

const SUGGESTIONS = [
  "How much did I spend on fertilizer this year?",
  "What did North 80 make?",
  "What does Smith Farms owe me?",
  "How much Roundup is left?",
  "What receipts am I missing?",
];

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    if (!q.trim()) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant/ask", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.answer ?? data.error ?? "No response." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Something went wrong reaching the assistant." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-40 w-14 h-14 rounded-full bg-forest text-white shadow-lg flex items-center justify-center hover:bg-forest-light"
        aria-label="Ask FarmLedger AI"
      >
        <Sparkles size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-0 md:p-6 bg-charcoal/30" onClick={() => setOpen(false)}>
          <div className="bg-white w-full md:w-96 h-[85vh] md:h-[600px] md:rounded-2xl rounded-t-2xl flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[--border-color]">
              <div className="font-semibold text-forest flex items-center gap-2"><Sparkles size={16} /> Ask FarmLedger</div>
              <button onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-charcoal/50">Ask about your actual farm records — nothing is invented.</p>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="block w-full text-left text-sm px-3 py-2 rounded-lg bg-cream hover:bg-cream-deep">{s}</button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`text-sm px-3 py-2 rounded-lg max-w-[85%] ${m.role === "user" ? "bg-forest text-white ml-auto" : "bg-cream"}`}>
                  {m.text}
                </div>
              ))}
              {loading && <div className="text-sm text-charcoal/40">Thinking…</div>}
            </div>
            <form
              className="flex items-center gap-2 p-3 border-t border-[--border-color]"
              onSubmit={(e) => { e.preventDefault(); ask(question); }}
            >
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about your farm…" className="input flex-1" />
              <button className="bg-forest text-white p-2.5 rounded-lg"><Send size={16} /></button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
