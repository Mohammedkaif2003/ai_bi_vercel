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
  CheckCircle
} from "lucide-react";
import type { DatasetPayload, User, AnalysisHistoryEntry, ChatSession, ChatMessage } from "@/lib/types";
import { generateReport } from "@/lib/api";
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

const THEMES = [
  { id: "light", name: "Clean Light", color: "#2563EB", bg: "bg-white", text: "text-slate-900" },
  { id: "dark", name: "Executive Dark", color: "#6366F1", bg: "bg-slate-950", text: "text-white" },
  { id: "blue", name: "Corporate Blue", color: "#1E3A8A", bg: "bg-blue-50", text: "text-blue-900" },
];

export default function ReportsTab({ 
  payload, 
  user, 
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
  const [selectedTheme, setSelectedTheme] = useState("light");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
        reportIntro,
        selectedTheme
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

  const selectedThemeData = THEMES.find(t => t.id === selectedTheme) || THEMES[0];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
            <Sparkles size={14} /> Report Builder
          </div>
          <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">Narrative Designer</h2>
          <p className="text-slate-400 max-w-xl text-lg leading-relaxed">
            Curate and theme your executive intelligence briefing.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all ${
              showPreview ? "bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/20" : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
            }`}
          >
            <Eye size={14} /> {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Insights ({selectedIndices.length})</h3>
             <div className="flex gap-2">
               <button onClick={() => setSelectedIndices(history.map((_, i) => i))} className="text-[10px] text-indigo-400 hover:underline">Select All</button>
               <span className="text-slate-700">/</span>
               <button onClick={() => setSelectedIndices([])} className="text-[10px] text-slate-500 hover:underline">Clear</button>
             </div>
          </div>
          
          <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-hide pr-2">
            <AnimatePresence mode="popLayout">
              {history.length === 0 && !isAnalyzing ? (
                <div className="text-center py-20 px-8 rounded-[2.5rem] bg-white/[0.02] border border-white/[0.05] border-dashed">
                  <MessageSquare className="text-slate-500 mx-auto mb-6" size={32} />
                  <h3 className="text-xl font-bold text-white mb-2">No Insights Found</h3>
                  <p className="text-slate-500 text-sm">Ask a question below to generate content.</p>
                </div>
              ) : (
                history.map((entry, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedIndices(prev => prev.includes(i) ? prev.filter(idx => idx !== i) : [...prev, i])}
                    className={`group p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden ${
                      selectedIndices.includes(i) ? "bg-indigo-600/10 border-indigo-500/40" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                    }`}
                  >
                    {selectedIndices.includes(i) && (
                      <motion.div layoutId="selection-border" className="absolute inset-0 border-2 border-indigo-500/50 rounded-[2rem] pointer-events-none" />
                    )}
                    <div className="flex items-start gap-4">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${
                        selectedIndices.includes(i) ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-500"
                      }`}>{i + 1}</div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold mb-2 ${selectedIndices.includes(i) ? "text-white" : "text-slate-300"}`}>{entry.query}</p>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{entry.ai_response}</p>
                      </div>
                      {selectedIndices.includes(i) ? <CheckCircle2 className="text-indigo-500" size={18} /> : <div className="w-4 h-4 rounded-full border border-white/10" />}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="relative flex items-center gap-3 p-2 bg-[#0B0F19] border border-white/10 rounded-2xl mt-6">
            <Sparkles className="ml-4 text-slate-500" size={18} />
            <input
              className="bg-transparent border-none focus:ring-0 text-sm text-white flex-1 py-3 outline-none"
              placeholder="Ask a question to append..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
              disabled={isAnalyzing}
            />
            <button 
              className={`p-3 rounded-xl transition-all ${chatInput.trim() && !isAnalyzing ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-700"}`}
              onClick={handleAskQuestion}
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-8 sticky top-24">
            {showPreview ? (
              <div className="space-y-6">
                 <div className="flex items-center justify-between mb-4">
                   <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Preview</h3>
                   <button onClick={() => setShowPreview(false)} className="text-[10px] text-indigo-400">Back to Settings</button>
                 </div>
                 
                 <div className={`aspect-[3/4] rounded-3xl p-6 overflow-y-auto scrollbar-hide border border-white/5 shadow-2xl ${selectedThemeData.bg}`}>
                    <div className="space-y-6">
                       <div className="border-b border-slate-200/10 pb-6 text-center">
                          <div className={`w-8 h-8 rounded-lg mx-auto mb-4 ${selectedTheme === 'dark' ? 'bg-indigo-500' : 'bg-slate-900'}`} />
                          <h4 className={`text-xl font-bold ${selectedThemeData.text}`}>{reportTitle}</h4>
                          <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest">Executive Briefing · {new Date().toLocaleDateString()}</p>
                       </div>
                       
                       {reportIntro && <p className={`text-[11px] italic leading-relaxed opacity-70 ${selectedThemeData.text}`}>{reportIntro}</p>}
                       
                       <div className="space-y-4">
                          {selectedIndices.map(idx => (
                            <div key={idx} className="space-y-2">
                               <h5 className={`text-[12px] font-bold ${selectedThemeData.text}`}>{history[idx]?.query}</h5>
                               <p className={`text-[10px] leading-relaxed opacity-60 ${selectedThemeData.text}`}>{history[idx]?.ai_response}</p>
                               {history[idx]?.chart && (
                                 <div className="h-20 rounded-xl bg-slate-500/5 border border-slate-500/10" />
                               )}
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
                 
                 <button onClick={handleGenerateReport} disabled={loading || selectedIndices.length === 0} className="btn-primary w-full py-5 rounded-2xl font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-3">
                   {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                   {isReady ? "Regenerate" : "Confirm & Build PDF"}
                 </button>
              </div>
            ) : (
              <div className="space-y-8">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <Settings size={22} className="text-indigo-400" /> Customization
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      {THEMES.map(t => (
                        <button 
                          key={t.id} 
                          onClick={() => setSelectedTheme(t.id)}
                          className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                            selectedTheme === t.id ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" : "bg-white/5 border-white/10 text-slate-500 hover:bg-white/10"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg shadow-inner ${t.bg} border border-white/10`} />
                          <span className="text-[9px] font-bold whitespace-nowrap">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Report Title</label>
                    <input 
                      type="text" value={reportTitle} 
                      onChange={(e) => setReportTitle(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Executive Intro</label>
                    <textarea 
                      value={reportIntro} 
                      onChange={(e) => setReportIntro(e.target.value)}
                      placeholder="Add a summary or opening remarks..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm text-white h-32 resize-none focus:border-indigo-500 outline-none transition-colors"
                    />
                  </div>

                  {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">{error}</div>}

                  <div className="pt-4">
                    {!isReady ? (
                      <button
                        onClick={handleGenerateReport}
                        disabled={loading || selectedIndices.length === 0}
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
                        <button onClick={() => setIsReady(false)} className="w-full text-slate-500 text-[10px] font-bold uppercase flex items-center justify-center gap-2 hover:text-white transition-colors">
                          <RotateCcw size={12} /> Start Over
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
