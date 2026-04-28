import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Head from "next/head";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  BarChart3, 
  Shield, 
  Zap, 
  ArrowRight,
  MessageSquare,
  TrendingUp,
  FileText
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import LandingDemo from "@/components/LandingDemo";
import { AnimatePresence } from "framer-motion";

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isDemoOpen, setIsDemoOpen] = useState(false);

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

  const features = [
    {
      title: "AI Conversations",
      description: "Ask complex business questions in plain English and get instant visual answers.",
      icon: MessageSquare,
      color: "text-blue-400",
      bg: "bg-blue-500/10"
    },
    {
      title: "Predictive Insights",
      description: "Advanced forecasting models that identify trends before they happen.",
      icon: TrendingUp,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10"
    },
    {
      title: "Executive Reports",
      description: "Automatically package your findings into professional, presentation-ready PDFs.",
      icon: FileText,
      color: "text-violet-400",
      bg: "bg-violet-500/10"
    }
  ];

  return (
    <>
      <Head>
        <title>Nexlytics AI | Intelligence Redefined</title>
        <meta name="description" content="Nexlytics is an enterprise-grade AI Business Intelligence platform for data analysis, forecasting, and automated reporting." />
      </Head>

      <div className="min-h-screen bg-[#030712] selection:bg-indigo-500/30">
        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 bg-[#030712]/80 backdrop-blur-xl border-b border-white/[0.05]">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LogoMark size={32} />
              <span className="text-white font-bold text-xl tracking-tight">Nexlytics</span>
            </div>
            <div className="flex items-center gap-6">
              <button 
                onClick={() => router.push("/login")}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button 
                onClick={handleAction}
                className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-200 transition-all active:scale-95"
              >
                {isLoggedIn ? "Dashboard" : "Get Started"}
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-40 pb-32 px-6 overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-violet-500/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-8"
            >
              <Sparkles size={14} />
              <span>The Future of BI is Here</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl md:text-8xl font-bold text-white tracking-tight leading-[1.1] mb-8"
            >
              Business Intelligence <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400">
                Powered by AI.
              </span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              Connect your data and talk to it in plain English. Nexlytics uses advanced generative AI to analyze trends, forecast outcomes, and generate reports instantly.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <button 
                onClick={handleAction}
                className="group bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-xl shadow-indigo-600/20 transition-all active:scale-95 text-lg"
              >
                {isLoggedIn ? "Go to Dashboard" : "Launch Dashboard"}
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => setIsDemoOpen(true)}
                className="px-8 py-4 rounded-2xl font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all text-lg"
              >
                View Demo
              </button>
            </motion.div>
          </div>
        </section>

        {/* Demo Showcase Overlay */}
        <AnimatePresence>
          {isDemoOpen && (
            <LandingDemo isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
          )}
        </AnimatePresence>

        {/* Features Section */}
        <section className="py-24 px-6 border-t border-white/[0.05]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-3xl font-bold text-white mb-4">Enterprise Grade Analytics</h2>
              <p className="text-slate-400 max-w-xl mx-auto italic">Everything you need to turn raw data into strategic decisions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((feature, i) => (
                <motion.div 
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card p-10 group hover:border-indigo-500/30 transition-all"
                >
                  <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center ${feature.color} mb-8 group-hover:scale-110 transition-transform`}>
                    <feature.icon size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats / Proof Section */}
        <section className="py-24 px-6 bg-gradient-to-b from-transparent to-indigo-500/[0.02]">
          <div className="max-w-7xl mx-auto glass-card p-12 flex flex-col md:flex-row items-center justify-around gap-12 text-center">
            <div>
              <p className="text-5xl font-bold text-white mb-2 tracking-tight">99%</p>
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Accuracy</p>
            </div>
            <div className="w-px h-12 bg-white/10 hidden md:block" />
            <div>
              <p className="text-5xl font-bold text-white mb-2 tracking-tight">10x</p>
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Faster Insights</p>
            </div>
            <div className="w-px h-12 bg-white/10 hidden md:block" />
            <div>
              <p className="text-5xl font-bold text-white mb-2 tracking-tight">Zero</p>
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Config Required</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/[0.05] text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <LogoMark size={24} />
            <span className="text-white font-bold text-sm tracking-tight">Nexlytics</span>
          </div>
          <p className="text-slate-500 text-xs mb-8">
            &copy; 2026 Nexlytics AI platform. All rights reserved. Built for professional analysts.
          </p>
          <div className="flex justify-center gap-8 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            <a href="#" className="hover:text-indigo-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Security</a>
          </div>
        </footer>
      </div>
    </>
  );
}
