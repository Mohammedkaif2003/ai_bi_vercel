import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Send,
  Layout,
  Type,
  Image as ImageIcon,
  Loader2,
  Check,
  RotateCcw
} from "lucide-react";
import type { DatasetPayload, User, AnalysisHistoryEntry, ChatSession } from "@/lib/types";
import { generateReport, analyze } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import PlotlyChart from "./PlotlyChart";

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
  
  // Customization State
  const [reportTitle, setReportTitle] = useState("AI-Assisted Executive Briefing");
  const [reportIntro, setReportIntro] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

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
                result: msgs[i].result_data || [],
                chart: msgs[i].chart_spec
              });
            }
          }
          setHistory(analysisEntries);
          setSelectedIndices(analysisEntries.map((_, i) => i));
        } else {
          setHistory([]);
          setSelectedIndices([]);
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
    setPdfUrl(null);
    setIsReady(false);
    
    try {
      const selectedHistory = [...history.filter((_, i) => selectedIndices.includes(i))];
      
      // Capture images for entries with charts
      setLoading(true);
      const PlotlyModule = await import("plotly.js/dist/plotly.js" as any);
      const Plotly = PlotlyModule.default || PlotlyModule;
      
      for (const entry of selectedHistory) {
        if (entry.chart) {
          try {
            // Render to a hidden div or just use toImage with the spec
            const div = document.createElement('div');
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
            
            const imgData = await Plotly.toImage(div, { format: 'png', width: 800, height: 450 });
            // imgData is "data:image/png;base64,..."
            entry.chart_b64 = imgData.split(',')[1];
            document.body.removeChild(div);
          } catch (chartErr) {
            console.error("Failed to capture chart image:", chartErr);
          }
        }
      }
      
      const res = await generateReport(
        selectedHistory,
        datasetName,
        user?.display_name || "Nexlytics User",
        reportTitle,
        reportIntro
      );
      
      const binary = atob(res.pdf_b64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setIsReady(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${reportTitle.replace(/\s+/g, '_')}_${datasetName.split('.')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
          chart: result.chart
        };
        const newHistory = [...history, newEntry];
        setHistory(newHistory);
        setSelectedIndices(prev => [...prev, newHistory.length - 1]);
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

  return (
    <div className="space-y-8 pb-12">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
            <Sparkles size={14} /> Report Builder
          </div>
          <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">
            Curate your story
          </h2>
          <p className="text-slate-400 max-w-xl text-lg leading-relaxed">
            Select the most impactful insights from your session and package them into a professional executive briefing.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedIndices(history.map((_, i) => i))}
            className="text-[10px] font-bold text-indigo-400 hover:text-white transition-colors uppercase tracking-widest bg-indigo-500/10 px-3 py-2 rounded-lg border border-indigo-500/20"
          >
            Select All
          </button>
          <button 
            onClick={() => setSelectedIndices([])}
            className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest bg-white/5 px-3 py-2 rounded-lg border border-white/10"
          >
            Clear
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Insight Selection */}
        <div className="lg:col-span-8 space-y-4">
          <AnimatePresence mode="popLayout">
            {history.length === 0 && !isAnalyzing ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 px-8 rounded-[2.5rem] bg-white/[0.02] border border-white/[0.05] border-dashed"
              >
                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="text-slate-500" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Insights Found</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                  Ask the AI Analyst a question to generate data points for your report.
                </p>
              </motion.div>
            ) : (
              history.map((entry, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => {
                    setSelectedIndices(prev => 
                      prev.includes(i) ? prev.filter(idx => idx !== i) : [...prev, i]
                    );
                    setIsReady(false); // Reset ready state if selection changes
                  }}
                  className={`group relative flex flex-col gap-4 p-5 rounded-[2rem] border transition-all cursor-pointer overflow-hidden ${
                    selectedIndices.includes(i) 
                      ? "bg-indigo-600/10 border-indigo-500/40 shadow-2xl shadow-indigo-500/10" 
                      : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                        selectedIndices.includes(i)
                          ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/40"
                          : "bg-white/5 text-slate-500 border border-white/10"
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className={`text-sm font-bold mb-1 transition-colors ${
                          selectedIndices.includes(i) ? "text-white" : "text-slate-400"
                        }`}>
                          {entry.query}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {entry.ai_response}
                        </p>
                      </div>
                    </div>
                    <div className={`shrink-0 transition-transform duration-300 ${selectedIndices.includes(i) ? "scale-110" : "scale-100"}`}>
                      {selectedIndices.includes(i) ? (
                        <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-white/10" />
                      )}
                    </div>
                  </div>

                  {entry.chart && (
                    <div className="relative mt-2 rounded-2xl overflow-hidden bg-black/20 border border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <div className="h-32 pointer-events-none grayscale-[0.5] contrast-[0.9]">
                        <PlotlyChart spec={entry.chart} height={128} />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute bottom-2 right-3 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-black/60 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/5">
                        <ImageIcon size={10} /> VISUAL INCLUDED
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>

          {isAnalyzing && (
            <div className="flex items-center gap-4 bg-indigo-500/5 p-6 rounded-[2rem] border border-indigo-500/10 border-dashed">
              <Loader2 className="text-indigo-400 animate-spin" size={24} />
              <p className="text-sm text-indigo-300 font-bold animate-pulse">Analyzing new insight for report...</p>
            </div>
          )}

          <div className="mt-8 relative group">
            <div className="absolute inset-0 bg-indigo-500/10 rounded-3xl blur-2xl group-focus-within:bg-indigo-500/20 transition-all opacity-0 group-focus-within:opacity-100" />
            <div className="relative flex items-center gap-3 p-2 bg-[#0B0F19] border border-white/10 rounded-[1.5rem] group-focus-within:border-indigo-500/50 transition-all">
              <div className="pl-4 text-slate-500">
                <Sparkles size={20} />
              </div>
              <input
                className="bg-transparent border-none focus:ring-0 text-sm text-white placeholder-slate-600 flex-1 py-3 outline-none"
                placeholder={payload ? "Ask a question to add to report..." : "Load a dataset to use live chat"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isAnalyzing || !payload}
              />
              <button 
                className={`p-3 rounded-2xl transition-all ${
                  chatInput.trim() && !isAnalyzing && payload
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/40" 
                    : "bg-white/5 text-slate-700 cursor-not-allowed"
                }`}
                onClick={handleAskQuestion} 
                disabled={isAnalyzing || !chatInput.trim() || !payload}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Configuration Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-8 sticky top-24">
            <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-8">
              <Settings size={22} className="text-indigo-400" />
              Settings
            </h3>

            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                  <Type size={14} className="text-indigo-400" /> Report Title
                </label>
                <input 
                  type="text"
                  value={reportTitle}
                  onChange={(e) => { setReportTitle(e.target.value); setIsReady(false); }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                  placeholder="Enter report title..."
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                  <FileText size={14} className="text-indigo-400" /> Executive Intro
                </label>
                <textarea 
                  value={reportIntro}
                  onChange={(e) => { setReportIntro(e.target.value); setIsReady(false); }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all h-32 resize-none"
                  placeholder="Optional: Add a brief overview or summary..."
                />
              </div>

              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Included Components</p>
                <div className="space-y-3">
                  {[
                    { label: "Executive Summary", icon: CheckCircle2 },
                    { label: "Data Profiling", icon: CheckCircle2 },
                    { label: "Deep-Dive Insights", icon: CheckCircle2 },
                    { label: "High-Res Visuals", icon: CheckCircle2 },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 text-xs text-slate-400">
                      <item.icon size={14} className="text-emerald-500" />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-medium">
                  {error}
                </div>
              )}

              <div className="pt-6">
                <AnimatePresence mode="wait">
                  {!isReady ? (
                    <motion.button
                      key="generate"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={handleGenerateReport}
                      disabled={loading || selectedIndices.length === 0}
                      className="btn-primary w-full py-5 flex items-center justify-center gap-3 group relative overflow-hidden disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="flex items-center gap-3">
                          <Loader2 size={20} className="animate-spin" />
                          <span className="font-bold tracking-wide uppercase text-xs">
                            {history.some((e, i) => selectedIndices.includes(i) && e.chart) 
                              ? "Capturing Visuals..." 
                              : "Preparing PDF..."}
                          </span>
                        </div>
                      ) : (
                        <>
                          <Layout size={20} />
                          <span className="font-bold tracking-wide uppercase text-xs">Prepare Report</span>
                        </>
                      )}
                    </motion.button>
                  ) : (
                    <div className="space-y-3">
                      <motion.button
                        key="download"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={handleDownload}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl flex items-center justify-center gap-3 font-bold shadow-xl shadow-emerald-600/20 transition-all border border-emerald-400/20"
                      >
                        <Download size={20} />
                        <span className="font-bold tracking-wide uppercase text-xs">Download PDF</span>
                      </motion.button>
                      <button 
                        onClick={() => setIsReady(false)}
                        className="w-full text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                      >
                        <RotateCcw size={12} /> Regenerate
                      </button>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
