import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Settings, 
  ListOrdered,
  Sparkles,
  ChevronRight
} from "lucide-react";
import type { DatasetPayload, User, AnalysisHistoryEntry } from "@/lib/types";
import { generateReport } from "@/lib/api";

interface Props {
  payload: DatasetPayload;
  user: User | null;
}

export default function ReportsTab({ payload, user }: Props) {
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("nexlytics_analysis_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  async function handleGenerateReport() {
    setLoading(true);
    setError("");
    try {
      const res = await generateReport(
        history,
        payload.filename,
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
      a.download = `Nexlytics_Report_${payload.filename.split('.')[0]}.pdf`;
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

  if (history.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[40vh] text-center"
      >
        <div className="w-16 h-16 bg-white/[0.03] rounded-2xl flex items-center justify-center mb-4 border border-white/[0.08]">
          <FileText className="text-slate-500" size={32} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          Your report is currently empty
        </h3>
        <p className="text-slate-400 max-w-sm">
          Head over to the AI Analyst tab and ask a question to start building your professional report.
        </p>
      </motion.div>
    );
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
          { label: "Analyses", value: history.length, sub: "Export ready" },
          { label: "AI Insights", value: insightsCount, sub: "Findings collected" },
          { label: "Visuals", value: chartsCount, sub: "Chart sections" },
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
            <span className="text-[10px] font-bold bg-white/5 px-2 py-1 rounded-lg text-slate-400">
              {history.length} SECTIONS
            </span>
          </div>
          
          <div className="space-y-3">
            {history.map((entry, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 bg-white/[0.02] p-4 rounded-xl border border-white/[0.05] group hover:bg-white/[0.04] transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold border border-indigo-500/20 group-hover:scale-110 transition-transform">
                  {i + 1}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm text-white font-medium truncate italic group-hover:text-indigo-200 transition-colors">
                    "{entry.query}"
                  </p>
                </div>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </motion.div>
            ))}
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
            disabled={loading}
            className="btn-primary w-full py-4 flex items-center justify-center gap-3 group"
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
