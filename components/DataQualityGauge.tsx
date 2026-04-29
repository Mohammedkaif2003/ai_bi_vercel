import { motion } from "framer-motion";

interface Props {
  score: number; // 0 to 100
  label: string;
}

export const DataQualityGauge = ({ score, label }: Props) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white/[0.03] border border-white/5 rounded-3xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-white/5"
          />
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
            className="text-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{score}%</span>
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Health</span>
        </div>
      </div>
      <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{label}</p>
    </div>
  );
};
