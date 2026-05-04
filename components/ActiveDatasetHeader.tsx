import { motion } from "framer-motion";
import { 
  Database, 
  ChevronRight, 
  X, 
  RefreshCw,
  AlertCircle,
  BarChart3
} from "lucide-react";
import type { DatasetPayload } from "@/lib/types";

interface ActiveDatasetHeaderProps {
  dataset: DatasetPayload | null;
  onSwitch: () => void;
  onClear: () => void;
}

export default function ActiveDatasetHeader({
  dataset,
  onSwitch,
  onClear
}: ActiveDatasetHeaderProps) {
  if (!dataset) return null;

  return (
    <div className="mb-6 z-40 relative">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl p-3 flex items-center justify-between shadow-2xl overflow-hidden group"
      >
        {/* Animated Background Pulse */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="flex items-center gap-3 pl-2">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500 blur-md opacity-20 animate-pulse" />
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Database size={18} />
              </div>
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em]">Active Dataset</span>
                <span className="w-1 h-1 rounded-full bg-slate-700" />
                <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                   <BarChart3 size={10} className="text-indigo-400" />
                   <span className="text-[11px] font-bold text-indigo-300 uppercase">{dataset.shape[0].toLocaleString()} Rows</span>
                </div>
              </div>
              <h2 className="text-sm font-bold text-white truncate max-w-[200px] md:max-w-md group-hover:text-indigo-300 transition-colors">
                {dataset.filename}
              </h2>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <button 
            onClick={onSwitch}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all group/btn"
          >
            <RefreshCw size={14} className="group-hover/btn:rotate-180 transition-transform duration-500 text-indigo-400" />
            <span>Switch Source</span>
          </button>
          
          <div className="w-px h-6 bg-white/5 mx-1" />
          
          <button 
            onClick={onClear}
            className="p-2 rounded-xl hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/20"
            title="Clear Active Dataset"
          >
            <X size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
