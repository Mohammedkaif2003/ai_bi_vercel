import { useRouter } from "next/router";
import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  ArrowRight,
  MessageSquare,
  TrendingUp,
  FileText,
  Zap,
  LayoutDashboard,
  Play,
  ShieldCheck,
  Settings,
  Command
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import LandingDemo from "@/components/LandingDemo";

const placeholders = [
  "Why did revenue drop in March?",
  "Show customer growth trends",
  "Predict next quarter sales",
  "Analyze marketing spend vs ROI"
];

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const resumeTypingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [placeholder, setPlaceholder] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  useEffect(() => {
    let charIndex = 0;
    let currentText = placeholders[placeholderIndex];
    
    const typingInterval = setInterval(() => {
      setPlaceholder(currentText.slice(0, charIndex));
      charIndex++;
      
      if (charIndex > currentText.length) {
        clearInterval(typingInterval);
        resumeTypingTimeout.current = setTimeout(() => {
          setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        }, 2500);
      }
    }, 80);
    
    return () => {
      clearInterval(typingInterval);
      if (resumeTypingTimeout.current) {
        clearTimeout(resumeTypingTimeout.current);
        resumeTypingTimeout.current = null;
      }
    };
  }, [placeholderIndex]);

  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsLoggedIn(!!session);
      });
    });
  }, []);

  const handleAction = () => {
    if (isLoggedIn) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  const featureHighlights = [
    { 
      icon: MessageSquare, 
      title: "Natural Language Queries", 
      desc: "Talk to your data in plain English",
      glow: "hover:shadow-[0_0_40px_rgba(59,130,246,0.15)]",
      border: "hover:border-blue-500/30"
    },
    { 
      icon: TrendingUp, 
      title: "Forecasting Engine", 
      desc: "Predict trends with AI",
      glow: "hover:shadow-[0_0_40px_rgba(99,102,241,0.15)]",
      border: "hover:border-indigo-500/30"
    },
    { 
      icon: FileText, 
      title: "Automated Reports", 
      desc: "Generate executive-ready insights",
      glow: "hover:shadow-[0_0_40px_rgba(168,85,247,0.15)]",
      border: "hover:border-violet-500/30"
    }
  ];

  return (
    <>
      <Head>
        <title>NEXLYTICS | Intelligence Redefined</title>
        <meta name="description" content="NEXLYTICS is a premium AI-driven Business Intelligence platform." />
      </Head>

      <div className="min-h-screen lg:h-screen w-full bg-[#020617] text-white overflow-x-hidden lg:overflow-hidden relative flex flex-col selection:bg-indigo-500/30">
        
        {/* Background Layers */}
        <div className="absolute inset-0 z-0">
           <div className="absolute inset-0 opacity-[0.04] pointer-events-none" 
                style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50 z-20" />
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />
           <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />
        </div>

        {/* TOP BAR (Ultra-Compact) */}
        <nav className="relative z-50 w-full px-6 md:px-10 py-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-8 h-8 flex items-center justify-center bg-white/[0.03] border border-white/10 rounded-lg group-hover:border-white/20 transition-all">
               <LogoMark size={20} />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase italic text-white group-hover:text-indigo-400 transition-colors">
              Nexlytics
            </span>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 hidden lg:block">
             <div className="px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10">
                <span className="text-[8px] font-black uppercase tracking-[0.5em] text-indigo-400">Intelligence Redefined</span>
             </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.02] border border-white/5 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <ShieldCheck size={10} className="text-emerald-500" />
                SOC-2
             </div>
             <div className="p-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-slate-500">
                <Settings size={14} />
             </div>
          </div>
        </nav>

        {/* MAIN CONTENT AREA (Optimized for 100% Zoom) */}
        <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-6 min-h-0">
          
          <div className="w-full max-w-5xl flex flex-col items-center gap-y-6 md:gap-y-10">
             
             {/* HERO TEXT */}
             <div className="text-center">
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl sm:text-6xl md:text-[80px] font-black tracking-tighter text-white leading-none mb-3 select-none"
                >
                  DATA ORACLE
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-lg md:text-xl font-semibold text-slate-300 tracking-tight mb-1"
                >
                  Conversational Business Intelligence
                </motion.p>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-slate-500 font-medium tracking-[0.1em] uppercase text-[9px] md:text-[10px]"
                >
                  Ask questions. Generate insights. Make decisions.
                </motion.p>
             </div>

             {/* QUERY INPUT */}
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.3 }}
               className="w-full max-w-lg relative group"
             >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-violet-500/10 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative bg-[#0B0F19]/60 backdrop-blur-3xl border border-white/10 rounded-xl p-3.5 flex items-center gap-3.5 shadow-2xl">
                   <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <Command size={16} />
                   </div>
                   <div className="flex-1 text-sm md:text-base font-medium text-slate-400 flex items-center overflow-hidden">
                      <span className="text-indigo-500 mr-2 font-black">{">"}</span>
                      <span className="truncate">{placeholder}</span>
                      <span className="w-1 h-4 bg-indigo-500 ml-1 animate-pulse" />
                   </div>
                   <div className="w-9 h-9 rounded-lg bg-white/[0.03] flex items-center justify-center text-slate-500">
                      <Zap size={16} />
                   </div>
                </div>
             </motion.div>

             {/* FEATURE CARDS (Compact Tiles) */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                {featureHighlights.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + (i * 0.1) }}
                    whileHover={{ y: -4 }}
                    className={`p-5 rounded-[1.5rem] bg-white/[0.02] border border-white/5 backdrop-blur-xl group cursor-default transition-all duration-300 ${f.glow} ${f.border}`}
                  >
                     <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-white/5 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                        <f.icon size={20} />
                     </div>
                     <h3 className="text-[9px] font-black text-white uppercase tracking-[0.2em] mb-1.5">{f.title}</h3>
                     <p className="text-[11px] text-slate-500 font-medium tracking-wide leading-relaxed group-hover:text-slate-300 transition-colors">{f.desc}</p>
                  </motion.div>
                ))}
             </div>

             {/* CTA BUTTONS (Perfectly Aligned) */}
             <motion.div 
               initial={{ opacity: 0, y: 15 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.7 }}
               className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center mt-2"
             >
               <button 
                 onClick={handleAction}
                 className="group relative px-8 py-3.5 bg-white text-black rounded-xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/5 overflow-hidden"
               >
                 <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                 <span>Start Analyzing</span>
                 <LayoutDashboard size={16} className="group-hover:rotate-12 transition-transform" />
               </button>

               <button 
                 onClick={() => setIsDemoOpen(true)}
                 className="group px-8 py-3.5 bg-white/[0.02] border border-white/10 backdrop-blur-2xl rounded-xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all hover:bg-white/5 active:scale-95 shadow-lg"
               >
                 <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                    <Play size={10} fill="currentColor" />
                 </div>
                 <span className="text-slate-400 group-hover:text-white transition-colors">Watch 2-Min Demo</span>
               </button>
             </motion.div>
             
          </div>
        </main>

        {/* Floating Accent (Fixed Position) */}
        <div className="absolute bottom-4 w-full text-center opacity-10 select-none pointer-events-none">
           <span className="text-[8px] font-black uppercase tracking-[1em] text-white">Nexlytics BI Operating System</span>
        </div>

        {/* Demo Showcase Overlay */}
        <AnimatePresence>
          {isDemoOpen && (
            <LandingDemo isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
          )}
        </AnimatePresence>

      </div>

      <style jsx global>{`
        body {
          overflow: hidden;
          background-color: #020617;
        }
      `}</style>
    </>
  );
}
