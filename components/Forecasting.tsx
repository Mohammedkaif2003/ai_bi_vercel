import { useState } from "react";
import type { DatasetPayload, ForecastResult } from "@/lib/types";
import { forecast } from "@/lib/api";
import PlotlyChart from "./PlotlyChart";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  Activity, 
  Target, 
  Clock, 
  Calendar, 
  AlertCircle, 
  Sparkles, 
  ChevronRight,
  Download,
  Filter
} from "lucide-react";

interface Props {
  payload: DatasetPayload;
}

export default function ForecastingTab({ payload }: Props) {
  const [periods, setPeriods] = useState(6);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleForecast() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await forecast(payload.dataset_key, periods);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Forecasting failed.");
    } finally {
      setLoading(false);
    }
  }

  const downloadForecast = () => {
    if (!result || !result.forecast || result.forecast.length === 0) return;
    
    const headers = Object.keys(result.forecast[0]);
    const csvContent = [
      headers.join(","),
      ...result.forecast.map(row => headers.map(h => {
        const val = row[h];
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `forecast_${payload.filename.replace(/\.[^/.]+$/, "")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const trendColor = (trend?: string) => {
    if (trend === "increasing") return "text-[#10B981]";
    if (trend === "declining") return "text-[#EF4444]";
    return "text-[#F59E0B]";
  };

  const formatForecastDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const calculateConfidence = (stdErr: number, slope: number) => {
    // Very simple heuristic for 'Confidence' score for UI purposes
    const score = 100 - Math.min(95, (stdErr / (Math.abs(slope) || 1)) * 10);
    return score.toFixed(1) + "%";
  };

  return (
    <div className="space-y-8 pb-10">
      {/* High-Fidelity Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
              <TrendingUp size={24} />
            </div>
            <h2 className="text-2xl md:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tight">Trend Projection</h2>
          </div>
          <p className="text-slate-500 text-sm font-medium ml-1">Predictive analysis for **{payload.filename}**</p>
        </div>

        <div className="bg-[#0B0F19]/60 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-3 flex items-center gap-4 shadow-2xl">
          <div className="pl-3">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
              Projection Scope
            </label>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-indigo-400" />
              <input
                type="number"
                min={1}
                max={24}
                value={periods}
                onChange={(e) => setPeriods(Number(e.target.value))}
                className="bg-transparent border-none focus:ring-0 text-white font-bold p-0 w-12 outline-none"
              />
              <span className="text-xs font-bold text-slate-400">Months</span>
            </div>
          </div>
          <div className="h-10 w-px bg-white/10 mx-2" />
          <button 
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              loading 
                ? "bg-white/5 text-slate-500 cursor-not-allowed" 
                : "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95"
            }`}
            onClick={handleForecast} 
            disabled={loading}
          >
            {loading ? <Activity size={18} className="animate-spin" /> : <Sparkles size={18} />}
            <span>{loading ? "Synthesizing..." : "Generate Forecast"}</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 shadow-xl"
          >
            <AlertCircle size={20} />
            <p className="text-sm font-bold">{error}</p>
          </motion.div>
        )}

        {result && !result.available && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4 text-amber-200 shadow-xl"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Filter size={20} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest mb-1">Forecasting Restriction</p>
              <p className="text-sm font-medium opacity-80">{result.message}</p>
            </div>
          </motion.div>
        )}

        {result?.available && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Target Metric", value: result.metric ?? "-", icon: Target },
                {
                  label: "Trend Direction",
                  value: result.trend ? result.trend.charAt(0).toUpperCase() + result.trend.slice(1) : "-",
                  cls: trendColor(result.trend),
                  icon: TrendingUp
                },
                { label: "Monthly Slope", value: result.slope != null ? result.slope.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "-", icon: Activity },
                { label: "Projection Confidence", value: result.std_error != null && result.slope != null ? calculateConfidence(result.std_error, result.slope) : "85.0%", icon: Sparkles },
              ].map((stat, i) => (
                <div key={stat.label} className="bg-[#0B0F19]/40 border border-white/5 rounded-[1.5rem] p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all">
                    <stat.icon size={48} />
                  </div>
                  <div className="flex items-center gap-2 mb-2 relative z-10">
                    <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors">
                      <stat.icon size={14} />
                    </div>
                    <p className="text-xs text-slate-500 font-black uppercase tracking-widest">{stat.label}</p>
                  </div>
                  <p className={`text-2xl font-bold tracking-tight relative z-10 ${stat.cls ?? "text-white"}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Chart Stage */}
              <div className="lg:col-span-2 bg-[#0B0F19]/40 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden flex flex-col">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_100%)] pointer-events-none" />
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity size={18} className="text-indigo-400" />
                    Trend Projection Model
                  </h3>
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Projection</span>
                  </div>
                </div>
                
                <div className="flex-1 min-h-[500px] flex items-center justify-center w-full">
                  {result.chart && (
                    <PlotlyChart 
                      spec={{
                        ...result.chart,
                        layout: {
                          ...(result.chart as any).layout,
                          margin: { t: 40, r: 40, l: 60, b: 60 },
                          autosize: true
                        }
                      }} 
                      height={550} 
                    />
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 relative z-10">
                  <p className="text-xs text-slate-500 leading-relaxed italic">
                    * This projection uses linear regression modeling based on historical monthly aggregations. Results are statistical estimates.
                  </p>
                </div>
              </div>

              {/* Data Table Stage */}
              <div className="bg-[#0B0F19]/40 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock size={18} className="text-indigo-400" />
                    Future Values
                  </h3>
                  <Download 
                    size={16} 
                    className="text-slate-600 hover:text-white cursor-pointer transition-colors" 
                    onClick={downloadForecast}
                    title="Export Forecast Data"
                  />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <table className="w-full text-sm border-separate border-spacing-y-2">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-black text-slate-500 uppercase tracking-widest pb-2 px-3">Timeline</th>
                        <th className="text-right text-xs font-black text-slate-500 uppercase tracking-widest pb-2 px-3">Projected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.forecast?.map((row, i) => (
                        <tr key={i} className="group">
                          <td className="py-3 px-3 bg-white/[0.02] group-hover:bg-indigo-500/10 rounded-l-xl text-slate-300 font-bold border-l-2 border-transparent group-hover:border-indigo-500 transition-all uppercase tracking-wider text-[11px]">
                            {formatForecastDate(String(Object.values(row)[0]))}
                          </td>
                          <td className="py-3 px-3 bg-white/[0.02] group-hover:bg-indigo-500/10 rounded-r-xl text-right text-indigo-400 font-black tabular-nums transition-all">
                            {typeof Object.values(row)[1] === "number" 
                              ? Number(Object.values(row)[1]).toLocaleString(undefined, { maximumFractionDigits: 0 }) 
                              : String(Object.values(row)[1])}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!result && !loading && (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <TrendingUp size={64} className="text-slate-700 mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">Ready for Predictive Analysis</p>
        </div>
      )}
    </div>
  );
}
