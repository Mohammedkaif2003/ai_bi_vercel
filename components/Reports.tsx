import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Settings, 
  Sparkles, 
  MessageSquare, 
  Send, 
  Layout, 
  Type, 
  ImageIcon, 
  Loader2, 
  Check, 
  RotateCcw,
  Eye,
  Palette,
  CheckCircle,
  History
} from "lucide-react";
import type { DatasetPayload, User, AnalysisHistoryEntry, ChatSession, ChatMessage } from "@/lib/types";
import { generateReport } from "@/lib/api";
import PlotlyChart from "./PlotlyChart";
import { supabase } from "@/lib/supabase";

interface Props {
  payload: DatasetPayload | null;
  user: User | null;
  activeSessionId?: string | null;
  sessions?: ChatSession[];
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isAnalyzing: boolean;
  chatError: string | null;
  selectedReportIndices: Set<number>;
  setSelectedReportIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
}

interface HistoricalInsight {
  query: string;
  ai_response: string;
  insight: string;
  result: any;
  chart: any;
  timestamp: number;
  session_title?: string;
  is_history?: boolean;
}

interface AnalysisHistoryEntryExtended extends AnalysisHistoryEntry {
  originalIdx: number;
  session_title?: string;
  is_active?: boolean;
}
const THEMES = [
  { id: "light", name: "Modern Light", color: "#6366F1", bg: "bg-white", text: "text-slate-900" },
  { id: "dark", name: "Modern Dark", color: "#818CF8", bg: "bg-[#030712]", text: "text-white" },
];

export default function ReportsTab({ 
  payload, 
  user, 
  messages, 
  sendMessage, 
  isAnalyzing, 
  chatError,
  selectedReportIndices,
  setSelectedReportIndices,
  activeSessionId
}: Props) {
  const [activeHistory, setActiveHistory] = useState<AnalysisHistoryEntryExtended[]>([]);
  const [globalHistory, setGlobalHistory] = useState<AnalysisHistoryEntryExtended[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  
  // Customization State
  const [reportTitle, setReportTitle] = useState("AI-Assisted Executive Briefing");
  const [reportIntro, setReportIntro] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Reset ready state if selection or content changes to force regeneration
  useEffect(() => {
    if (isReady) {
      setIsReady(false);
      setPdfUrl(null);
    }
  }, [selectedReportIndices, reportTitle, reportIntro]);

  useEffect(() => {
    const analysisEntries: AnalysisHistoryEntryExtended[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'assistant' && messages[i].query_type !== 'irrelevant') {
        const prevMsg = i > 0 && messages[i - 1].role === 'user' ? messages[i - 1].content : "Insight";
        analysisEntries.push({
          query: prevMsg,
          ai_response: messages[i].content,
          insight: messages[i].content,
          result: messages[i].result || [],
          chart: messages[i].chart,
          originalIdx: i,
          is_active: true
        });
      }
    }
    setTimeout(() => setActiveHistory(analysisEntries), 0);
  }, [messages]);

  useEffect(() => {
    async function fetchAllHistory() {
      if (!user?.id) return;
      setLoadingHistory(true);
      try {
        let query = supabase
          .from("chat_sessions")
          .select("id, title, dataset_key")
          .eq("user_id", user.id);
        
        if (activeSessionId) {
          query = query.neq("id", activeSessionId);
        }

        const { data: sessions, error: sErr } = await query;
        if (sErr) throw sErr;
        if (!sessions || sessions.length === 0) {
          setGlobalHistory([]);
          return;
        }

        const sessionIds = sessions.map(s => s.id);
        const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s.title]));

        const { data: msgs, error: mErr } = await supabase
          .from("chat_messages")
          .select("*")
          .in("session_id", sessionIds)
          .eq("role", "assistant")
          .neq("query_type", "irrelevant")
          .order("created_at", { ascending: false });

        if (mErr) throw mErr;

        const entries: AnalysisHistoryEntryExtended[] = (msgs || []).map((m, idx) => ({
          query: "Insight",
          ai_response: m.content,
          insight: m.content,
          result: m.result_data || [],
          chart: m.chart_spec,
          originalIdx: -(idx + 1),
          session_title: sessionMap[m.session_id],
          is_active: false
        }));

        setGlobalHistory(entries);
      } catch (err) {
        console.error("Failed to fetch global history:", err);
      } finally {
        setLoadingHistory(false);
      }
    }

    fetchAllHistory();
  }, [user?.id, activeSessionId]);

  const allHistory = [...activeHistory, ...globalHistory];

  const toggleSelection = (msgIdx: number) => {
    setSelectedReportIndices(prev => {
      const next = new Set(prev);
      if (next.has(msgIdx)) next.delete(msgIdx);
      else next.add(msgIdx);
      return next;
    });
  };

  async function handleGenerateReport() {
    if (selectedReportIndices.size === 0) {
      setError("Please select at least one insight for the report.");
      return;
    }
    setLoading(true);
    setError("");
    setPdfUrl(null);
    setIsReady(false);
    
    try {
      const selectedHistory = allHistory.filter((h) => selectedReportIndices.has(h.originalIdx));
      const PlotlyModule = await import("plotly.js/dist/plotly.js" as any);
      const Plotly = PlotlyModule.default || PlotlyModule;
      
      for (const entry of selectedHistory) {
        if (entry.chart) {
          const div = document.createElement('div');
          try {
            div.style.position = 'absolute';
            div.style.left = '-9999px';
            div.style.width = '800px';
            div.style.height = '450px';
            document.body.appendChild(div);
            
            await Plotly.newPlot(div, (entry.chart as any).data || [], {
              ...(entry.chart as any).layout,
              paper_bgcolor: 'white',
              plot_bgcolor: 'white',
              font: { color: '#333', family: 'Helvetica' },
              margin: { l: 60, r: 30, t: 40, b: 60 },
              width: 800,
              height: 450
            });
            
            await new Promise(r => setTimeout(r, 200));
            const imgData = await Plotly.toImage(div, { format: 'png', width: 800, height: 450 });
            if (imgData && imgData.length > 1000) {
              entry.chart_b64 = imgData.split(',')[1];
            }
          } catch (chartErr) {
            console.error("Failed to capture chart image:", chartErr);
          } finally {
            if (div.parentNode) {
              document.body.removeChild(div);
            }
          }
        }
      }
      
      const res = await generateReport(
        selectedHistory,
        payload?.filename || "Report",
        user?.display_name || "User",
        payload?.dataset_key,
        reportTitle,
        reportIntro,
        "light"
      );
      
      const binary = atob(res.pdf_b64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      const blob = new Blob([array], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
      setIsReady(true);
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${reportTitle.replace(/\s+/g, '_')}.pdf`;
    a.click();
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-[0.2em] mb-2">
            <Sparkles size={14} /> Report Builder
          </div>
          <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">Narrative Designer</h2>
          <p className="text-slate-400 max-w-xl text-lg leading-relaxed">
            Curate and theme your executive intelligence briefing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Insights ({selectedReportIndices.size})</h3>
             <div className="flex gap-2">
               <button onClick={() => setSelectedReportIndices(new Set(allHistory.map(h => h.originalIdx)))} className="text-xs text-indigo-400 hover:underline">Select All</button>
               <span className="text-slate-700">/</span>
               <button onClick={() => setSelectedReportIndices(new Set())} className="text-xs text-slate-500 hover:underline">Clear</button>
             </div>
          </div>
          
          <div className="space-y-8 max-h-[700px] overflow-y-auto scrollbar-hide pr-2">
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl w-fit">
                <Sparkles size={12} className="text-indigo-400" />
                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Active Session Insights</span>
              </div>
              
              <AnimatePresence mode="popLayout">
                {activeHistory.length === 0 ? (
                  <div className="text-center py-10 px-8 rounded-[2rem] bg-white/[0.01] border border-white/[0.03] border-dashed">
                    <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">No active insights yet</p>
                  </div>
                ) : (
                  activeHistory.map((entry, i) => (
                    <motion.div 
                      key={`active-${entry.originalIdx}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => toggleSelection(entry.originalIdx)}
                      className={`group p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden ${
                        selectedReportIndices.has(entry.originalIdx) ? "bg-indigo-600/10 border-indigo-500/40" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                          selectedReportIndices.has(entry.originalIdx) ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-500"
                        }`}>{i + 1}</div>
                        <div className="flex-1">
                          <p className={`text-sm font-bold mb-2 ${selectedReportIndices.has(entry.originalIdx) ? "text-white" : "text-slate-300"}`}>{entry.query}</p>
                          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{entry.ai_response}</p>
                        </div>
                        {selectedReportIndices.has(entry.originalIdx) ? <CheckCircle2 className="text-indigo-500" size={18} /> : <div className="w-4 h-4 rounded-full border border-white/10" />}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-4 pt-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-500/10 border border-slate-500/20 rounded-xl w-fit">
                <History size={12} className="text-slate-400" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Historical Archive</span>
              </div>

              <AnimatePresence mode="popLayout">
                {globalHistory.length === 0 ? (
                  <div className="text-center py-10 px-8 rounded-[2rem] bg-white/[0.01] border border-white/[0.03] border-dashed">
                    <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">No previous sessions found</p>
                  </div>
                ) : (
                  globalHistory.map((entry, i) => (
                    <motion.div 
                      key={`global-${entry.originalIdx}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => toggleSelection(entry.originalIdx)}
                      className={`group p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden ${
                        selectedReportIndices.has(entry.originalIdx) ? "bg-indigo-600/10 border-indigo-500/40" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                          selectedReportIndices.has(entry.originalIdx) ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-500"
                        }`}>{i + 1}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-black text-indigo-400/60 uppercase tracking-widest">{entry.session_title}</span>
                          </div>
                          <p className={`text-sm font-bold mb-2 ${selectedReportIndices.has(entry.originalIdx) ? "text-white" : "text-slate-300"}`}>{entry.ai_response.substring(0, 60)}...</p>
                          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{entry.ai_response}</p>
                        </div>
                        {selectedReportIndices.has(entry.originalIdx) ? <CheckCircle2 className="text-indigo-500" size={18} /> : <div className="w-4 h-4 rounded-full border border-white/10" />}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-8 sticky top-24">
              <div className="space-y-8">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <Settings size={22} className="text-indigo-400" /> Customization
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Report Title</label>
                    <input 
                      type="text" value={reportTitle} 
                      onChange={(e) => setReportTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleGenerateReport(); }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Executive Intro</label>
                    <textarea 
                      value={reportIntro} 
                      onChange={(e) => setReportIntro(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerateReport(); } }}
                      placeholder="Add a summary or opening remarks..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm text-white h-32 resize-none focus:border-indigo-500 outline-none transition-colors"
                    />
                  </div>

                  {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">{error}</div>}

                  <div className="pt-4">
                    {!isReady ? (
                      <button
                        onClick={handleGenerateReport}
                        disabled={loading || selectedReportIndices.size === 0}
                        className="btn-primary w-full py-5 flex items-center justify-center gap-3 rounded-2xl shadow-xl shadow-indigo-600/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Layout size={18} />}
                        <span className="font-black uppercase text-xs tracking-widest">Generate Report</span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <button
                          onClick={handleDownload}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20"
                        >
                          <Download size={20} /> <span className="font-black uppercase text-xs tracking-widest">Download PDF</span>
                        </button>
                        <button onClick={() => setIsReady(false)} className="w-full text-slate-500 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:text-white transition-colors">
                          <RotateCcw size={12} /> Start Over
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
