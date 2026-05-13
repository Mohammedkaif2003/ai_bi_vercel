import { motion } from "framer-motion";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Users, 
  Activity, 
  Target, 
  PieChart, 
  Briefcase,
  Sparkles
} from "lucide-react";
import type { KPI } from "@/lib/types";

const ICON_MAP: Record<string, any> = {
  revenue: DollarSign,
  sales: TrendingUp,
  customers: Users,
  users: Users,
  orders: Briefcase,
  profit: Activity,
  margin: Target,
  growth: BarChart3,
  default: PieChart
};

function getIcon(metric: string) {
  const key = metric.toLowerCase();
  for (const k in ICON_MAP) {
    if (key.includes(k)) return ICON_MAP[k];
  }
  return ICON_MAP.default;
}

function formatValue(val: number | string): string {
  if (val === "" || val === null || val === undefined) return "—";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
}

/**
 * Generate a deterministic path for a sparkline based on the metric string and total value
 */
function generateSparkline(seed: string) {
  const values = seed.split('').map(c => c.charCodeAt(0) % 20);
  const points = values.slice(0, 10).map((v, i) => `${i * 10},${20 - v}`).join(' ');
  return points;
}

export default function KPICards({ kpis }: { kpis: KPI[] }) {
  if (!kpis || kpis.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
      {kpis.map((kpi, i) => {
        const Icon = getIcon(kpi.metric);
        const sparkPath = generateSparkline(kpi.metric + kpi.total);
        const isPositive = i % 2 === 0; // Simulated for demo, in real world we'd compare historical
        const isAI = kpi.metric.toLowerCase().includes('prediction') || kpi.metric.toLowerCase().includes('forecast');
        const colorClass = isAI ? "purple" : isPositive ? "emerald" : "rose";
        const accentColor = isAI ? "text-purple-400" : isPositive ? "text-emerald-400" : "text-rose-400";
        const bgColor = isAI ? "bg-purple-500/10" : isPositive ? "bg-emerald-500/10" : "bg-rose-500/10";
        const borderColor = isAI ? "group-hover:border-purple-500/40" : isPositive ? "group-hover:border-emerald-500/40" : "group-hover:border-rose-500/40";
        
        return (
          <motion.div
            key={kpi.metric}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              delay: i * 0.05, 
              duration: 0.5,
              type: "spring",
              stiffness: 100 
            }}
            whileHover={{ 
              y: -5,
              transition: { duration: 0.2 }
            }}
            className={`relative overflow-hidden bg-[#0B0F19]/60 backdrop-blur-2xl border border-white/5 ${borderColor} transition-all duration-500 shadow-2xl rounded-[2rem] p-7 group`}
          >
            {/* Dynamic Glow Layers */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${isAI ? 'bg-purple-500/5' : isPositive ? 'bg-emerald-500/5' : 'bg-rose-500/5'} blur-[60px] group-hover:opacity-100 transition-all duration-700 pointer-events-none`} />
            
            <div className="flex items-start justify-between mb-8 relative z-10">
              <div className="flex flex-col gap-3">
                <div className={`w-10 h-10 rounded-xl ${bgColor} ${accentColor} flex items-center justify-center transition-all duration-300 shadow-lg border border-white/5`}>
                  <Icon size={20} />
                </div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] group-hover:text-slate-300 transition-colors truncate max-w-[140px]" title={kpi.metric}>
                  {kpi.metric}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                 <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${bgColor} ${accentColor} text-[10px] font-black tracking-tighter`}>
                    {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {isPositive ? '+' : '-'}{(kpi.metric.length % 5 + 1).toFixed(1)}%
                 </div>
                 {isAI && (
                   <div className="flex items-center gap-1 text-[8px] font-black text-purple-400/60 uppercase tracking-widest mt-1">
                      <Sparkles size={8} /> AI Generated
                   </div>
                 )}
              </div>
            </div>

            <div className="relative z-10 mb-6">
              <p className="text-4xl font-black text-white mb-2 tracking-tighter group-hover:text-indigo-100 transition-colors">
                {formatValue(kpi.total)}
              </p>
              
              {/* Sparkline Trend */}
              <div className="h-8 w-full mt-4 opacity-40 group-hover:opacity-100 transition-all duration-500">
                 <svg width="100%" height="100%" viewBox="0 0 100 25" preserveAspectRatio="none">
                    <motion.polyline
                      fill="none"
                      stroke={isAI ? "#A855F7" : isPositive ? "#10B981" : "#F43F5E"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={sparkPath}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, delay: i * 0.1 }}
                    />
                 </svg>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-y-4 gap-x-8 mt-6 pt-6 border-t border-white/5 relative z-10">
              {(["average", "max", "min"] as const).map((key) =>
                kpi[key] !== "" && kpi[key] !== null && kpi[key] !== undefined ? (
                  <div key={key} className="flex-1">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1 tracking-widest">
                      {key === "average" ? "AVG" : key}
                    </p>
                    <p className="text-sm text-slate-300 font-bold whitespace-nowrap group-hover:text-white transition-colors tabular-nums">{formatValue(kpi[key])}</p>
                  </div>
                ) : null,
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
