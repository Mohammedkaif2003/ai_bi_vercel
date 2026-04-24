import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Sparkles, 
  Bot, 
  User as UserIcon, 
  HelpCircle,
  Table as TableIcon,
  ChevronRight,
  Trash2
} from "lucide-react";
import type { DatasetPayload, ChatMessage, AnalysisHistoryEntry, User } from "@/lib/types";
import { analyze } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import PlotlyChart from "./PlotlyChart";

interface Props {
  payload: DatasetPayload;
  user: User;
  onSwitchToForecast?: () => void;
  explicitSessionId?: string | null;
  onSessionCreated?: (session: any) => void;
}

export default function AIAnalyst({ payload, user, explicitSessionId, onSessionCreated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<AnalysisHistoryEntry[]>([]);

  // 1. Load session and messages on mount or dataset change
  useEffect(() => {
    async function loadHistory() {
      if (!user.id) return;
      let sessionData = null;

      if (explicitSessionId) {
        const { data } = await supabase
          .from('chat_sessions')
          .select('id')
          .eq('id', explicitSessionId)
          .single();
        sessionData = data;
      }


      if (sessionData) {
        setSessionId(sessionData.id);
        
        // Load messages for this session
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionData.id)
          .order('created_at', { ascending: true });

        if (msgs && msgs.length > 0) {
          const formattedMsgs: ChatMessage[] = msgs.map(m => ({
            role: m.role,
            content: m.content,
            result: m.result_data,
            chart: m.chart_spec,
            query_type: m.query_type,
            timestamp: new Date(m.created_at).getTime()
          }));
          setMessages(formattedMsgs);
          
          // Sync analysis history for reports
          const analysisEntries = formattedMsgs
            .filter(m => m.role === 'assistant' && m.query_type !== 'irrelevant')
            .map(m => ({
              query: "Previous Query", // We don't store the user query paired in the same row, but we could find it
              ai_response: m.content,
              insight: m.content,
              result: m.result || []
            }));
          historyRef.current = analysisEntries;
        } else {
          showGreeting();
        }
      } else {
        showGreeting();
      }
    }

    function showGreeting() {
      setMessages([
        {
          role: "assistant",
          content: `Hello! I'm your AI Analyst. I've indexed **${payload.filename}** (${payload.shape[0].toLocaleString()} rows). \n\nAsk me about trends, distributions, or specific comparisons. How can I help you explore this data today?`,
          timestamp: Date.now(),
        },
      ]);
    }

    loadHistory();
  }, [payload.filename, user.id, explicitSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text?: string) {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);

    const userTimestamp = Date.now();
    const userMsg: ChatMessage = { role: "user", content: q, timestamp: userTimestamp };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // 2. Ensure session exists
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        const { data: newSession, error: sessionErr } = await supabase
          .from('chat_sessions')
          .insert({ 
            user_id: user.id, 
            dataset_name: payload.filename,
            dataset_key: payload.key,
            title: q.length > 30 ? q.substring(0, 30) + '...' : q
          })
          .select()
          .single();
        
        if (sessionErr) throw sessionErr;
        activeSessionId = newSession.id;
        setSessionId(activeSessionId);
        if (onSessionCreated) onSessionCreated(newSession);
      }

      // 3. Save User Message
      await supabase.from('chat_messages').insert({
        session_id: activeSessionId,
        role: 'user',
        content: q,
        created_at: new Date(userTimestamp).toISOString()
      });

      const result = await analyze(q, payload.csv_b64, payload.filename);
      const assistantTimestamp = Date.now();
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: result.narration || result.summary || "I've analyzed the data but couldn't generate a narration.",
        result: result.result,
        chart: result.chart,
        query_type: result.query_type,
        timestamp: assistantTimestamp,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // 4. Save Assistant Message
      await supabase.from('chat_messages').insert({
        session_id: activeSessionId,
        role: 'assistant',
        content: aiMsg.content,
        chart_spec: aiMsg.chart,
        result_data: aiMsg.result,
        query_type: aiMsg.query_type,
        created_at: new Date(assistantTimestamp).toISOString()
      });

      if (result.query_type !== "irrelevant") {
        const entry: AnalysisHistoryEntry = {
          query: q,
          ai_response: result.narration || result.summary || "",
          insight: result.summary || "",
          result: result.result || [],
        };
        historyRef.current = [...historyRef.current, entry];
        sessionStorage.setItem("nexlytics_analysis_history", JSON.stringify(historyRef.current));
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err.message || "Analysis failed. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleClearChat() {
    if (confirm("Are you sure you want to clear the analysis history? This will also remove items from your Report.")) {
      if (sessionId) {
        supabase.from('chat_messages').delete().eq('session_id', sessionId).then(() => {
           setMessages([
            {
              role: "assistant",
              content: `Chat cleared. Ask me anything about **${payload.filename}**.`,
              timestamp: Date.now(),
            },
          ]);
        });
      }
      historyRef.current = [];
      sessionStorage.removeItem("nexlytics_analysis_history");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const { schema } = payload;
  const metric = schema.numeric_columns[0];
  const category = schema.categorical_columns[0];
  const suggestions = [
    metric && category ? `Total ${metric} by ${category}` : null,
    metric && category ? `Top 5 ${category} by ${metric}` : null,
    schema.datetime_columns[0] && metric ? `Trend of ${metric} over time` : null,
    metric ? `Average ${metric} distribution` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col h-[calc(100vh-250px)] min-h-[550px] relative">
      <div className="absolute top-0 right-2 z-10">
        <button 
          onClick={handleClearChat}
          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          title="Clear Chat"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Clear Chat</span>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-6 px-2 pb-24 pt-10 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div 
              key={msg.timestamp + idx}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-start gap-3`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/20">
                  <Bot size={18} />
                </div>
              )}
              
              <div className="flex flex-col gap-2 max-w-[85%]">
                <div className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {msg.chart && msg.query_type !== "irrelevant" && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-4 -mx-2 bg-black/20 rounded-xl overflow-hidden border border-white/5 shadow-inner"
                    >
                      <PlotlyChart spec={msg.chart} height={340} />
                    </motion.div>
                  )}

                  {!msg.chart && msg.result && msg.result.length > 0 && msg.result.length <= 10 && (
                    <div className="mt-4 p-3 bg-black/20 rounded-xl border border-white/5 overflow-x-auto">
                      <div className="flex items-center gap-2 mb-2 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                        <TableIcon size={12} /> Data Result
                      </div>
                      <table className="text-xs w-full border-collapse">
                        <thead>
                          <tr className="border-b border-white/5">
                            {Object.keys(msg.result[0]).map((col) => (
                              <th key={col} className="py-2 px-2 text-left text-slate-500 font-bold whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.result.map((row, ri) => (
                            <tr key={ri} className="border-b border-white/[0.02] last:border-0">
                              {Object.values(row).map((val, ci) => (
                                <td key={ci} className="py-2 px-2 text-slate-300 whitespace-nowrap">
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
                <span className="text-[10px] text-slate-600 font-medium px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 shrink-0 border border-white/10">
                  <UserIcon size={18} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start items-start gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/20">
              <Bot size={18} className="animate-pulse" />
            </div>
            <div className="chat-bubble-ai flex items-center gap-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ 
                      scale: [1, 1.3, 1],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1, 
                      delay: i * 0.2 
                    }}
                    className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
                  />
                ))}
              </div>
              <span className="text-slate-400 font-medium italic">Analyzing dataset...</span>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#030712] via-[#030712]/90 to-transparent">
        {suggestions.length > 0 && messages.length <= 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 mb-4"
          >
            {suggestions.map((s) => (
              <button
                key={s}
                className="group flex items-center gap-2 text-[11px] bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-500 rounded-xl px-4 py-2 transition-all shadow-lg"
                onClick={() => sendMessage(s)}
              >
                <Sparkles size={12} className="group-hover:text-indigo-200" />
                {s}
              </button>
            ))}
          </motion.div>
        )}

        <div className="relative group">
          <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-xl group-focus-within:bg-indigo-500/20 transition-all opacity-0 group-focus-within:opacity-100" />
          <div className="relative flex items-center gap-2 p-1.5 glass-card !rounded-2xl border-white/10 group-focus-within:border-indigo-500/50 transition-all">
            <div className="pl-3 text-slate-500">
              <HelpCircle size={18} />
            </div>
            <input
              className="bg-transparent border-none focus:ring-0 text-sm text-white placeholder-slate-500 flex-1 py-2"
              placeholder="Ask a question about this data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button 
              className={`p-2 rounded-xl transition-all ${
                input.trim() && !loading 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/40" 
                  : "bg-white/5 text-slate-600 cursor-not-allowed"
              }`}
              onClick={() => sendMessage()} 
              disabled={loading || !input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
