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
  Image as ImageIcon, 
  Loader2, 
  Check, 
  RotateCcw 
} from "lucide-react";
import type { DatasetPayload, User, AnalysisHistoryEntry, ChatSession, ChatMessage } from "@/lib/types";
import { generateReport } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import PlotlyChart from "./PlotlyChart";

interface Props {
  payload: DatasetPayload | null;
  user: User | null;
  activeSessionId?: string | null;
  sessions?: ChatSession[];
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isAnalyzing: boolean;
  chatError: string | null;
}

export default function ReportsTab({ 
  payload, 
  user, 
  activeSessionId, 
  sessions,
  messages,
  sendMessage,
  isAnalyzing,
  chatError
}: Props) {
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  
  // Customization State
  const [reportTitle, setReportTitle] = useState("AI-Assisted Executive Briefing");
  const [reportIntro, setReportIntro] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Sync hook messages to report history format
  useEffect(() => {
    const analysisEntries: AnalysisHistoryEntry[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'assistant' && messages[i].query_type !== 'irrelevant') {
        const prevMsg = i > 0 && messages[i - 1].role === 'user' ? messages[i - 1].content : "Insight";
        analysisEntries.push({
          query: prevMsg,
          ai_response: messages[i].content,
          insight: messages[i].content,
          result: messages[i].result || [],
          chart: messages[i].chart
        });
      }
    }
    setHistory(analysisEntries);

    // Auto-select everything by default or newly added items using functional update
    setSelectedIndices(prev => {
      if (analysisEntries.length > 0 && prev.length === 0) {
        return analysisEntries.map((_, i) => i);
      } else if (analysisEntries.length > prev.length) {
        return [...prev, analysisEntries.length - 1];
      }
      return prev;
    });
  }, [messages]);

  async function handleAskQuestion() {
    if (!payload) return;
    const q = chatInput.trim();
    if (!q || isAnalyzing) return;
    setChatInput("");
    await sendMessage(q);
  }

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
      const selectedHistory = history.filter((_, i) => selectedIndices.includes(i));
      
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
            
            const imgData = await Plotly.toImage(div, { format: 'png', width: 800, height: 450 });
            entry.chart_b64 = imgData.split(',')[1];
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
        reportTitle,
        reportIntro
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
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
            <Sparkles size={14} /> Report Builder
          </div>
          <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">Curate your story</h2>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <AnimatePresence mode="popLayout">
            {history.length === 0 && !isAnalyzing ? (
              <div className="text-center py-20 px-8 rounded-[2.5rem] bg-white/[0.02] border border-white/[0.05] border-dashed">
                <MessageSquare className="text-slate-500 mx-auto mb-6" size={32} />
                <h3 className="text-xl font-bold text-white mb-2">No Insights Found</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">Ask a question below to generate data points.</p>
              </div>
            ) : (
              history.map((entry, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSelectedIndices(prev => prev.includes(i) ? prev.filter(idx => idx !== i) : [...prev, i])}
                  className={`group p-5 rounded-[2rem] border transition-all cursor-pointer ${
                    selectedIndices.includes(i) ? "bg-indigo-600/10 border-indigo-500/40 shadow-2xl" : "bg-white/[0.02] border-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold ${
                        selectedIndices.includes(i) ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-500"
                      }`}>{i + 1}</div>
                      <div>
                        <p className={`text-sm font-bold mb-1 ${selectedIndices.includes(i) ? "text-white" : "text-slate-400"}`}>{entry.query}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">{entry.ai_response}</p>
                      </div>
                    </div>
                    {selectedIndices.includes(i) ? (
                      <Check className="text-indigo-500" size={20} />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-white/10" />
                    )}
                  </div>
                  {entry.chart && (
                    <div className="mt-4 h-32 rounded-2xl overflow-hidden bg-black/20 border border-white/5">
                      <PlotlyChart spec={entry.chart} height={128} />
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>

          {isAnalyzing && (
            <div className="flex items-center gap-4 bg-indigo-500/5 p-6 rounded-[2rem] border border-indigo-500/10 border-dashed animate-pulse">
              <Loader2 className="text-indigo-400 animate-spin" size={24} />
              <p className="text-sm text-indigo-300 font-bold">Analyzing new insight...</p>
            </div>
          )}

          <div className="mt-8 relative flex items-center gap-3 p-2 bg-[#0B0F19] border border-white/10 rounded-[1.5rem]">
            <Sparkles className="ml-4 text-slate-500" size={20} />
            <input
              className="bg-transparent border-none focus:ring-0 text-sm text-white flex-1 py-3 outline-none"
              placeholder="Ask a question to add to report..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
              disabled={isAnalyzing || !payload}
            />
            <button 
              className={`p-3 rounded-2xl ${chatInput.trim() && !isAnalyzing ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-700"}`}
              onClick={handleAskQuestion}
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-8 sticky top-24">
            <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-8">
              <Settings size={22} className="text-indigo-400" /> Settings
            </h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Report Title</label>
                <input 
                  type="text" value={reportTitle} 
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Executive Intro</label>
                <textarea 
                  value={reportIntro} 
                  onChange={(e) => setReportIntro(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm text-white h-32 resize-none"
                />
              </div>
              {(error || chatError) && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">{error || chatError}</div>
              )}
              <div className="pt-6">
                {!isReady ? (
                  <button
                    onClick={handleGenerateReport}
                    disabled={loading || selectedIndices.length === 0}
                    className="btn-primary w-full py-5 flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <Layout size={20} />}
                    <span className="font-bold uppercase text-xs">Prepare Report</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleDownload}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl flex items-center justify-center gap-3"
                    >
                      <Download size={20} /> <span className="font-bold uppercase text-xs">Download PDF</span>
                    </button>
                    <button onClick={() => setIsReady(false)} className="w-full text-slate-500 text-[10px] font-bold uppercase flex items-center justify-center gap-2">
                      <RotateCcw size={12} /> Regenerate
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
