import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Settings, 
  ListOrdered,
  Sparkles,
  ChevronRight,
  CheckSquare,
  Square,
  MessageSquare,
  Bot,
  Send
} from "lucide-react";
import type { DatasetPayload, User, AnalysisHistoryEntry, ChatSession } from "@/lib/types";
import { generateReport, analyze } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface Props {
  payload: DatasetPayload | null;
  user: User | null;
  activeSessionId?: string | null;
  sessions?: ChatSession[];
}

export default function ReportsTab({ payload, user, activeSessionId, sessions }: Props) {
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const currentSession = sessions?.find(s => s.id === activeSessionId);
  const datasetName = payload?.filename || currentSession?.dataset_name || "Historical_Dataset";

  useEffect(() => {
    async function fetchHistory() {
      if (activeSessionId) {
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', activeSessionId)
          .order('created_at', { ascending: true });

        if (msgs && msgs.length > 0) {
          const analysisEntries: AnalysisHistoryEntry[] = [];
          for (let i = 0; i < msgs.length; i++) {
            if (msgs[i].role === 'assistant' && msgs[i].query_type !== 'irrelevant') {
              const prevMsg = i > 0 && msgs[i - 1].role === 'user' ? msgs[i - 1].content : "Previous Query";
              analysisEntries.push({
                query: prevMsg,
                ai_response: msgs[i].content,
                insight: msgs[i].content,
                result: msgs[i].result_data || []
              });
            }
          }
          setHistory(analysisEntries);
          setSelectedIndices(analysisEntries.map((_, i) => i));
        } else {
          setHistory([]);
          setSelectedIndices([]);
        }
      } else {
        try {
          const stored = sessionStorage.getItem("nexlytics_analysis_history");
          if (stored) {
            const parsed = JSON.parse(stored);
            setHistory(parsed);
            setSelectedIndices(parsed.map((_: any, i: number) => i));
          } else {
            setHistory([]);
            setSelectedIndices([]);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    fetchHistory();
  }, [activeSessionId]);

  async function handleGenerateReport() {
    if (selectedIndices.length === 0) {
      setError("Please select at least one insight for the report.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const selectedHistory = history.filter((_, i) => selectedIndices.includes(i));
      const res = await generateReport(
        selectedHistory,
        datasetName,
        user?.display_name || "Nexlytics User"
      );
      
      const binary = atob(res.pdf_b64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `Nexlytics_Report_${datasetName.split('.')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  async function handleAskQuestion() {
    if (!payload) {
      setError("Please load a dataset to use live chat.");
      return;
    }
    const q = chatInput.trim();
    if (!q || isAnalyzing) return;
    setChatInput("");
    setIsAnalyzing(true);
    setError("");

    try {
      if (activeSessionId) {
        await supabase.from('chat_messages').insert({
          session_id: activeSessionId,
          role: 'user',
          content: q,
          created_at: new Date().toISOString()
        });
      }

      const result = await analyze(q, payload.csv_b64, payload.filename);

      if (activeSessionId) {
        await supabase.from('chat_messages').insert({
          session_id: activeSessionId,
          role: 'assistant',
          content: result.narration || result.summary || "Analysis completed.",
          chart_spec: result.chart,
          result_data: result.result,
          query_type: result.query_type,
          created_at: new Date().toISOString()
        });
      }

      if (result.query_type !== "irrelevant") {
        const newEntry: AnalysisHistoryEntry = {
          query: q,
          ai_response: result.narration || result.summary || "",
          insight: result.summary || "",
          result: result.result || [],
        };
        const newHistory = [...history, newEntry];
        setHistory(newHistory);
        setSelectedIndices(prev => [...prev, newHistory.length - 1]);
        sessionStorage.setItem("nexlytics_analysis_history", JSON.stringify(newHistory));
      } else {
        setError("Could not generate a relevant insight for the report.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate insight.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  }

  const insightsCount = history.filter((h) => h.insight).length;
  const chartsCount = history.length;

  return (
    <div className="space-y-8">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
          <Sparkles size={14} /> Executive Reporting
        </div>
        <h2 className="text-3xl font-bold text-white mb-3">
          Package your insights
        </h2>
        <p className="text-slate-400 max-w-2xl text-lg">
          Bundle your analysis history, visualizations, and AI narratives into a presentation-ready PDF document.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: "Analyses", value: selectedIndices.length, sub: "Export ready" },
          { label: "AI Insights", value: selectedIndices.filter(i => history[i]?.insight).length, sub: "Findings collected" },
          { label: "Visuals", value: selectedIndices.length, sub: "Chart sections" },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 text-center"
          >
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-4xl font-bold text-white mb-1">{stat.value}</p>
            <p className="text-[10px] text-indigo-400 font-bold uppercase">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ListOrdered size={20} className="text-indigo-400" />
              Report Structure
            </h3>
            <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded-lg">
              {selectedIndices.length} OF {history.length} SELECTED
            </span>
          </div>
          
          <div className="space-y-3">
            {history.length === 0 && !isAnalyzing && (
              <div className="text-center py-8 px-4 text-slate-400 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                <MessageSquare className="mx-auto mb-2 opacity-50" size={24} />
                <p className="text-sm">No insights generated yet.</p>
                <p className="text-xs mt-1">Ask a question below to start building your report.</p>
              </div>
            )}
            {history.map((entry, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  setSelectedIndices(prev => 
                    prev.includes(i) ? prev.filter(idx => idx !== i) : [...prev, i]
                  );
                }}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedIndices.includes(i) 
                    ? "bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20" 
                    : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-transform ${
                  selectedIndices.includes(i)
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                    : "bg-white/5 text-slate-400 border border-white/10"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className={`text-sm font-medium truncate transition-colors ${
                    selectedIndices.includes(i) ? "text-white italic" : "text-slate-400"
                  }`}>
                    "{entry.query}"
                  </p>
                </div>
                {selectedIndices.includes(i) ? (
                  <CheckSquare size={18} className="text-indigo-400" />
                ) : (
                  <Square size={18} className="text-slate-500" />
                )}
              </motion.div>
            ))}
            
            {isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Bot size={18} className="animate-pulse" />
                </div>
                <p className="text-sm text-indigo-300 font-medium animate-pulse">Generating insight...</p>
              </motion.div>
            )}
          </div>

          {/* Live Chat Input */}
          <div className="mt-6 relative group">
            <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-xl group-focus-within:bg-indigo-500/20 transition-all opacity-0 group-focus-within:opacity-100" />
            <div className="relative flex items-center gap-2 p-1.5 glass-card !rounded-2xl border-white/10 group-focus-within:border-indigo-500/50 transition-all bg-[#0B0F19]">
              <div className="pl-3 text-slate-500">
                <Sparkles size={18} />
              </div>
              <input
                className="bg-transparent border-none focus:ring-0 text-sm text-white placeholder-slate-500 flex-1 py-2 outline-none"
                placeholder={payload ? "Ask a question to add to report..." : "Load a dataset to use live chat"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isAnalyzing || !payload}
              />
              <button 
                className={`p-2 rounded-xl transition-all ${
                  chatInput.trim() && !isAnalyzing && payload
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/40" 
                    : "bg-white/5 text-slate-600 cursor-not-allowed"
                }`}
                onClick={handleAskQuestion} 
                disabled={isAnalyzing || !chatInput.trim() || !payload}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 glass-card p-6 flex flex-col"
        >
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
            <Settings size={20} className="text-indigo-400" />
            Configuration
          </h3>
          
          <div className="space-y-6 mb-8 flex-1">
            <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Document Format</p>
              <p className="text-white font-semibold">Narrative Executive Briefing</p>
            </div>
            
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Sections to include</p>
              <ul className="space-y-3">
                {[
                  "Cover page with dataset profiling",
                  "AI-generated Executive Summary",
                  "Deep-dive analysis sections",
                  "Interactive chart captures",
                  "Statistical reference tables"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-xs text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-rose-400 text-xs mb-4 p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg"
            >
              {error}
            </motion.p>
          )}

          <button
            onClick={handleGenerateReport}
            disabled={loading || selectedIndices.length === 0}
            className="btn-primary w-full py-4 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
                <span>Export Executive PDF</span>
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
