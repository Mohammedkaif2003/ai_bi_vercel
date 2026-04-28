import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Sparkles, 
  TrendingUp, 
  LayoutDashboard, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  MessageSquare,
  Zap,
  X
} from 'lucide-react';

// Sample Data for the Demo
const SAMPLE_DATA = {
  filename: "global_sales_2024.csv",
  rows: 15420,
  columns: 8,
  kpis: [
    { label: "Total Revenue", value: "$4.2M", change: "+12.5%", positive: true },
    { label: "Avg. Deal Size", value: "$12.4k", change: "+4.2%", positive: true },
    { label: "Active Regions", value: "42", change: "0%", positive: true },
    { label: "Growth Rate", value: "22.4%", change: "-1.2%", positive: false },
  ],
  insights: [
    "Q4 sales in North America are trending 15% higher than previous projections.",
    "Data reveals a strong correlation (0.88) between Marketing Spend and Enterprise conversions.",
    "Retention in APAC has improved by 8% following the localized support rollout.",
    "Predictive models suggest a potential surge in SaaS renewals during the next 30 days."
  ],
  columns_list: ["Date", "Region", "Product_Line", "Revenue", "Units", "Customer_Segment", "Lead_Source", "Sentiment"],
  preview_rows: [
    { Date: "2024-03-01", Region: "North America", Product_Line: "Enterprise Pro", Revenue: "12500", Units: "1", Customer_Segment: "Fortune 500", Lead_Source: "Organic", Sentiment: "Positive" },
    { Date: "2024-03-01", Region: "Europe", Product_Line: "Cloud Starter", Revenue: "2400", Units: "5", Customer_Segment: "SMB", Lead_Source: "Referral", Sentiment: "Neutral" },
    { Date: "2024-03-02", Region: "APAC", Product_Line: "Analytics Suite", Revenue: "45000", Units: "2", Customer_Segment: "Government", Lead_Source: "Direct", Sentiment: "Positive" },
    { Date: "2024-03-02", Region: "LATAM", Product_Line: "Enterprise Pro", Revenue: "8900", Units: "1", Customer_Segment: "Mid-Market", Lead_Source: "Paid Search", Sentiment: "Positive" },
    { Date: "2024-03-03", Region: "North America", Product_Line: "Support Plus", Revenue: "1200", Units: "10", Customer_Segment: "SMB", Lead_Source: "Organic", Sentiment: "Neutral" },
  ]
};

export default function LandingDemo({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [demoPage, setDemoPage] = useState(1);
  const [isTyping, setIsTyping] = useState(true);
  const [demoQuery, setDemoQuery] = useState("");
  const fullQuery = "Show me the revenue growth trends for Q4...";

  useEffect(() => {
    if (isOpen) {
      let i = 0;
      const timer = setInterval(() => {
        setDemoQuery(fullQuery.slice(0, i));
        i++;
        if (i > fullQuery.length) {
          clearInterval(timer);
          setTimeout(() => setIsTyping(false), 1000);
        }
      }, 50);
      return () => clearInterval(timer);
    } else {
      setDemoQuery("");
      setIsTyping(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-[#030712]/95 backdrop-blur-2xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-6xl h-full max-h-[90vh] bg-[#0B0F19] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(99,102,241,0.2)] overflow-hidden flex flex-col relative"
      >
        {/* Demo Header */}
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#0F172A]/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Zap size={20} className="text-white fill-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg tracking-tight">Interactive Showcase</h3>
              <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.2em]">Experiencing Nexlytics PRO</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          {/* Mock Chat Simulation */}
          <div className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
              <Sparkles size={120} className="text-indigo-500" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">AI Analyst</span>
              </div>
              
              <div className="flex flex-col gap-6">
                <div className="bg-white/5 p-5 rounded-3xl rounded-tl-none max-w-md border border-white/5 backdrop-blur-md">
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Hello! I've analyzed your <b className="text-white">Global Sales</b> dataset. What specific insights are you looking for today?
                  </p>
                </div>
                
                <div className="self-end bg-indigo-600 p-5 rounded-3xl rounded-tr-none max-w-md shadow-2xl shadow-indigo-600/40">
                  <p className="text-sm text-white font-semibold leading-relaxed">
                    {demoQuery}{isTyping && <span className="animate-pulse ml-0.5 font-light">|</span>}
                  </p>
                </div>
                
                <AnimatePresence>
                  {!isTyping && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/5 p-6 rounded-3xl rounded-tl-none border border-emerald-500/20 backdrop-blur-xl"
                    >
                      <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                        Based on current trends, revenue is projected to grow by <b className="text-emerald-400">12% in Q4</b>, primarily driven by Enterprise segments in North America.
                      </p>
                      
                      <div className="h-40 w-full bg-indigo-500/5 rounded-2xl flex items-end justify-around p-6 gap-3 border border-white/5">
                        {[40, 65, 45, 85, 100, 75, 90].map((h, i) => (
                          <motion.div 
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                            className="w-full bg-gradient-to-t from-indigo-600 to-violet-400 rounded-t-lg relative group/bar"
                          >
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity">
                              {h}%
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {SAMPLE_DATA.kpis.map((kpi, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem] hover:bg-white/[0.06] transition-all hover:scale-[1.02]"
              >
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white tracking-tight">{kpi.value}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${kpi.positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {kpi.change}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Data Preview Mock */}
          <div className="card overflow-hidden border border-white/10 relative shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-white/5 z-30">
              <div className="h-full w-1/4 bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            </div>
            
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-[#0F172A]/80 backdrop-blur-xl">
               <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Professional Data Preview</p>
                <p className="text-xs text-slate-500 font-medium tracking-tight">Viewing Sample Data · {SAMPLE_DATA.rows.toLocaleString()} Rows Total</p>
               </div>
               <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2 py-1">
                  <div className="p-1.5 text-slate-600"><ChevronLeft size={16} /></div>
                  <span className="text-[11px] font-bold text-white min-w-[2.5rem] text-center">1 / 154</span>
                  <div className="p-1.5 text-indigo-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"><ChevronRight size={16} /></div>
                </div>
               </div>
            </div>
            
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <table className="w-full text-[11px] text-left border-collapse table-auto">
                <thead className="bg-[#0F172A] sticky top-0">
                  <tr>
                    {SAMPLE_DATA.columns_list.slice(0, 6).map(col => (
                      <th key={col} className="py-5 px-8 text-slate-500 font-bold uppercase tracking-widest border-b border-white/10 whitespace-nowrap min-w-[150px]">
                        <span className="text-white/80">{col}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_DATA.preview_rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors group">
                      {SAMPLE_DATA.columns_list.slice(0, 6).map(col => (
                        <td key={col} className="py-4 px-8 text-slate-300 font-medium whitespace-nowrap bg-[#0F172A]/30">
                          <span className="group-hover:text-indigo-300 transition-colors">{(row as any)[col]}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CTA Footer */}
        <div className="p-10 border-t border-white/5 bg-[#030712]/90 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <h4 className="text-white font-bold text-2xl mb-2 tracking-tight">Experience the future of BI today.</h4>
            <p className="text-slate-500 text-base max-w-lg leading-relaxed font-medium">Stop digging through spreadsheets. Connect your data and start asking questions.</p>
          </div>
          <button 
            className="w-full md:w-auto bg-white text-black px-10 py-5 rounded-[2rem] font-bold text-xl hover:bg-indigo-600 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-4 shadow-[0_0_50px_rgba(255,255,255,0.1)]"
            onClick={() => window.location.href = '/login'}
          >
            Launch Dashboard
            <ArrowRight size={24} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
