import { useState, useRef, useEffect } from "react";
import type { DatasetPayload, ChatMessage, AnalysisHistoryEntry } from "@/lib/types";
import { analyze } from "@/lib/api";
import PlotlyChart from "./PlotlyChart";

interface Props {
  payload: DatasetPayload;
  onSwitchToForecast?: () => void;
}

export default function AIAnalyst({ payload, onSwitchToForecast }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `📊 **Dataset loaded: ${payload.filename}** — **${payload.shape[0].toLocaleString()} rows** × **${payload.shape[1]} columns**. Ready for analysis. Ask me about trends, distributions, top performers, comparisons, or forecasts.`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Export analysis history for reports tab
  // We store it in sessionStorage so Reports component can access it
  const historyRef = useRef<AnalysisHistoryEntry[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = {
      role: "user",
      content: q,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await analyze(q, payload.csv_b64, payload.filename);
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: result.narration || result.summary || "No insight returned.",
        result: result.result,
        chart: result.chart,
        query_type: result.query_type,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Persist to history for Reports
      if (result.query_type !== "irrelevant") {
        const entry: AnalysisHistoryEntry = {
          query: q,
          ai_response: result.narration || result.summary || "",
          insight: result.summary || "",
          result: result.result || [],
        };
        historyRef.current = [...historyRef.current, entry];
        sessionStorage.setItem(
          "apex_analysis_history",
          JSON.stringify(historyRef.current),
        );
      }
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${err instanceof Error ? err.message : "Analysis failed. Please try again."}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Example suggestions based on schema
  const { schema } = payload;
  const metric = schema.numeric_columns[0];
  const category = schema.categorical_columns[0];
  const suggestions = [
    metric && category ? `What is the total ${metric} by ${category}?` : null,
    metric && category ? `Which ${category} has the highest ${metric}?` : null,
    schema.datetime_columns[0] && metric
      ? `What is the trend of ${metric} over time?`
      : null,
    metric ? `Are there outliers in ${metric}?` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg) => (
          <div
            key={msg.timestamp}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}>
              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

              {/* Chart */}
              {msg.chart && msg.query_type !== "irrelevant" && (
                <div className="mt-3 -mx-4 -mb-3 bg-[#0F172A]/50 rounded-b-2xl overflow-hidden">
                  <PlotlyChart spec={msg.chart} height={320} />
                </div>
              )}

              {/* Result table (small results ≤ 8 rows) */}
              {!msg.chart &&
                msg.result &&
                msg.result.length > 0 &&
                msg.result.length <= 8 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="text-xs w-full border-collapse">
                      <thead>
                        <tr className="border-b border-[#334155]">
                          {Object.keys(msg.result[0]).map((col) => (
                            <th
                              key={col}
                              className="py-1 px-2 text-left text-[#64748B] font-semibold whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.result.map((row, ri) => (
                          <tr key={ri} className="border-b border-[#1E293B]">
                            {Object.values(row).map((val, ci) => (
                              <td key={ci} className="py-1 px-2 text-[#CBD5E1] whitespace-nowrap">
                                {String(val ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 bg-[#4F46E5] rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-[#64748B]">Analyzing…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.slice(0, 3).map((s) => (
            <button
              key={s}
              className="text-xs bg-[#1E293B] border border-[#334155] text-[#818CF8]
                         hover:bg-[#334155] rounded-full px-3 py-1.5 transition-colors"
              onClick={() => { setInput(s); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Ask about your data…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="btn-primary px-4"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
