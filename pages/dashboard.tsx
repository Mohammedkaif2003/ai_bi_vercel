import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  TrendingUp,
  FileText,
  LogOut,
  Database,
  Upload,
  ChevronLeft,
  ChevronRight,
  Info,
  Library, 
  Plus, 
  Search, 
  ChevronDown, 
  Trash2, 
  Edit2, 
  AlertCircle,
  LucideIcon,
  Bell,
  BookOpen,
  Share2,
  Sparkles,
  History as HistoryIcon,
  HelpCircle,
  Table as TableIcon,
  Filter,
  Loader2,
  Activity,
  ShieldCheck,
  Rocket,
  ArrowRight
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import {
  listDatasets,
  loadDataset,
  uploadCsv,
  fileToBase64,
  generateReport,
  searchDataset
} from "@/lib/api";
import type { DatasetPayload, User, DatasetInfo, ChatSession } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import KPICards from "@/components/KPICards";
import AIAnalyst from "@/components/AIAnalyst";
import ForecastingTab from "@/components/Forecasting";
import { useChat } from "@/hooks/useChat";
import ReportsTab from "@/components/Reports";
import LiveBoard from "@/components/LiveBoard";
import LogoMark from "@/components/LogoMark";
import Sidebar from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { Toaster, toast } from "sonner";
import { useStore, type Tab } from "@/hooks/useStore";

export default function DashboardPage() {
  const router = useRouter();
  
  // Zustand Store
  const {
    user, setUser,
    activeTab, setActiveTab,
    sidebarCollapsed, setSidebarCollapsed,
    datasetPayload, setDatasetPayload,
    activeSessionId, setActiveSessionId,
    chatSessions, setChatSessions,
    availableDatasets, setAvailableDatasets,
    dataSource, setDataSource,
    selectedKeys, setSelectedKeys,
    loadingDataset, setLoadingDataset,
    datasetError, setDatasetError,
    pendingDatasetToActivate, setPendingDatasetToActivate
  } = useStore();
  
  const [sessionDataset, setSessionDataset] = useState<DatasetPayload | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [newChatKey, setNewChatKey] = useState("new");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery") || 
                       window.location.search.includes("type=recovery");
    
    if (isRecovery) {
      router.push(`/login${window.location.hash}${window.location.search}`);
      return;
    }

    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser({
          id: session.user.id,
          username: session.user.email?.split("@")[0] || "User",
          display_name: session.user.user_metadata?.display_name || session.user.email || "User",
          role: "Pro Analyst",
          token: session.access_token
        });
      } else {
        router.replace("/login");
      }
    }

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push("/login#type=recovery");
        return;
      }
      if (!session) {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, setUser]);

  useEffect(() => {
    listDatasets()
      .then((r) => {
        setAvailableDatasets(r.datasets);
      })
      .catch((err: unknown) => {
        setDatasetError(err instanceof Error ? err.message : "Failed to load dataset list.");
      });
  }, [setAvailableDatasets, setDatasetError]);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setChatSessions(data as ChatSession[]);
  }, [user, setChatSessions]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Unified Chat State
  const chatDatasetKey = useMemo(() => datasetPayload?.dataset_key, [datasetPayload?.dataset_key]);
  const chatDatasetName = useMemo(() => datasetPayload?.filename, [datasetPayload?.filename]);

  const {
    messages,
    isLoading: isAnalyzing,
    error: chatError,
    sendMessage,
    clearChat,
    setSessionId
  } = useChat({
    user,
    datasetKey: chatDatasetKey,
    datasetName: chatDatasetName,
    initialSessionId: activeSessionId,
    onSessionCreated: (session) => {
      setActiveSessionId(session.id);
      setChatSessions((prev) => [session, ...prev]);
    }
  });

  const [selectedReportIndices, setSelectedReportIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (activeTab === "analyst") {
      fetchSessions();
    }
  }, [activeTab, fetchSessions]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleLoadSelected(keysOverride?: string[]) {
    const keys = keysOverride || selectedKeys;
    if (keys.length === 0) return;
    setLoadingDataset(true);
    setDatasetError("");
    try {
      const payload = await loadDataset(keys[0]);
      if (datasetPayload && datasetPayload.dataset_key !== payload.dataset_key) {
        setPendingDatasetToActivate(payload);
        toast.info("Dataset preview loaded", { description: "Review the data or activate it for analysis." });
      } else {
        setDatasetPayload(payload);
        setSessionDataset(payload);
        toast.success(`Dataset "${payload.filename}" loaded successfully!`);
      }
      setActiveSessionId(null);
      setNewChatKey(Date.now().toString());
      setShowMobileMenu(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dataset.";
      setDatasetError(msg);
      toast.error("Loading failed", { description: msg });
    } finally {
      setLoadingDataset(false);
    }
  }

  async function processFile(file: File) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error("Invalid file type", { description: "Please upload a CSV file." });
      return;
    }
    setLoadingDataset(true);
    setDatasetError("");
    try {
      let storagePath = undefined;
      let b64 = "";

      if (file.size > 2 * 1024 * 1024 && user) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        storagePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('user_datasets').upload(storagePath, file);
        if (uploadError) throw uploadError;
      } else {
        b64 = await fileToBase64(file);
      }

      const payload = await uploadCsv(b64, file.name, storagePath);
      setDatasetPayload(payload);
      setSessionDataset(payload);
      setActiveSessionId(null);
      setSelectedKeys([]);
      setNewChatKey(Date.now().toString());
      toast.success("File processed successfully", {
        description: `${file.name} is now active.`,
        icon: <Upload size={16} className="text-emerald-400" />
      });
      setShowMobileMenu(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process file.";
      setDatasetError(msg);
      toast.error("Upload failed", { description: msg });
    } finally {
      setLoadingDataset(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = "";
  }

  function handleNewChat() {
    setSessionDataset(datasetPayload);
    setActiveSessionId(null);
    setNewChatKey(Date.now().toString());
    setActiveTab("analyst");
    setShowMobileMenu(false);
  }

  async function handleLoadSession(session: ChatSession) {
    const keyToLoad = session.dataset_key || session.dataset_name;
    if (!keyToLoad) return;
    setLoadingDataset(true);
    setDatasetError("");
    try {
      const payload = await loadDataset(keyToLoad);
      setSessionDataset(payload);
      if (datasetPayload && datasetPayload.dataset_key !== payload.dataset_key) {
        setPendingDatasetToActivate(payload);
      } else if (!datasetPayload) {
        setPendingDatasetToActivate(payload);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dataset.";
      if (msg.includes("not found")) {
        setSessionDataset(null);
      } else {
        setDatasetError(msg);
        setLoadingDataset(false);
        return;
      }
    }
    setActiveSessionId(session.id);
    setActiveTab("analyst");
    setLoadingDataset(false);
    setShowMobileMenu(false);
  }

  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteSessionId(sessionId);
  }

  async function performDeleteSession() {
    if (!deleteSessionId) return;
    await supabase.from("chat_sessions").delete().eq("id", deleteSessionId);
    setChatSessions((prev) => prev.filter((s) => s.id !== deleteSessionId));
    if (activeSessionId === deleteSessionId) setActiveSessionId(null);
    setDeleteSessionId(null);
  }

  async function handleRenameSession(session: ChatSession, newTitle: string) {
    if (!newTitle || newTitle.trim() === "" || newTitle === session.title) return;
    await supabase.from("chat_sessions").update({ title: newTitle }).eq("id", session.id);
    setChatSessions((prev) => prev.map((s) => s.id === session.id ? { ...s, title: newTitle } : s));
  }

  function handleConfirmActivation() {
    if (pendingDatasetToActivate) {
      setDatasetPayload(pendingDatasetToActivate);
      setSessionDataset(pendingDatasetToActivate);
      toast.success("Dataset activated", { description: `${pendingDatasetToActivate.filename} is now active.` });
      setPendingDatasetToActivate(null);
    }
  }

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: "Data Overview", icon: Database },
    { id: "analyst", label: "AI Analyst", icon: MessageSquare },
    { id: "forecast", label: "Forecasting", icon: TrendingUp },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "board", label: "Live Board", icon: LayoutDashboard },
  ];

  return (
    <div 
      className="h-screen flex flex-col bg-mesh overflow-hidden relative selection:bg-indigo-500/30"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { if (e.relatedTarget === null) setIsDragging(false); }}
      onDrop={async (e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) await processFile(file); }}
    >
      <Head><title>Nexlytics | Dashboard</title></Head>

      {/* Atmospheric Layers */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 grid-overlay opacity-50" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-violet-500/10 blur-[150px] rounded-full" />
        
        {/* Subtle Floating Graph Lines Overlay */}
        <div className="absolute inset-0 opacity-[0.08] flex items-center justify-center">
           <svg width="100%" height="100%" viewBox="0 0 800 600" fill="none" className="scale-150">
              <path d="M0 400C100 380 200 420 300 350C400 280 500 320 600 250C700 180 800 220 800 200" stroke="white" strokeWidth="0.8" strokeDasharray="12 12" />
              <path d="M0 500C150 450 250 300 400 350C550 400 650 200 800 150" stroke="indigo" strokeWidth="1.5" />
           </svg>
        </div>

        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-10"
            animate={{ 
              y: [0, -30, 0],
              opacity: [0.05, 0.15, 0.05]
            }}
            transition={{ 
              duration: 4 + Math.random() * 4, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: Math.random() * 5
            }}
            style={{ 
              left: Math.random() * 100 + "%", 
              top: Math.random() * 100 + "%" 
            }}
          />
        ))}
      </div>

      <Toaster position="top-right" theme="dark" closeButton richColors />
      
      {/* Premium Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-indigo-900/20 backdrop-blur-3xl border-[6px] border-dashed border-indigo-500/30 flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              className="p-16 rounded-[4rem] bg-[#030712]/95 border border-white/10 shadow-[0_0_100px_rgba(79,70,229,0.4)] flex flex-col items-center gap-8 text-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-30 animate-pulse" />
                <div className="relative w-28 h-28 rounded-3xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <Upload size={48} className="animate-bounce" />
                </div>
              </div>
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">Intelligence Awaits</h2>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CommandPalette 
        onSelectTab={(tab) => setActiveTab(tab as Tab)} datasets={availableDatasets}
        onSelectDataset={(key) => { setSelectedKeys([key]); handleLoadSelected([key]); }}
      />

      <div className="flex flex-1 overflow-hidden w-full h-full relative z-10">
          <aside className={`${sidebarCollapsed ? "w-20" : "w-72"} shrink-0 hidden md:block transition-all duration-500 ease-in-out`}>
              <Sidebar 
                onLoadSelected={handleLoadSelected} onProcessFile={processFile} onFileUpload={handleFileUpload}
                onNewChat={handleNewChat} onLoadSession={handleLoadSession} onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession} onSignOut={handleSignOut}
              />
          </aside>

          <main className="flex-1 h-full flex flex-col overflow-hidden p-6 relative">
            
            {/* Top Navigation Bar */}
            <div className="flex gap-1.5 mb-10 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5 backdrop-blur-2xl shadow-2xl overflow-x-auto scrollbar-hide">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`flex-1 shrink-0 min-w-[150px] flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 relative ${activeTab === t.id ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {activeTab === t.id && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute inset-0 tab-active-premium rounded-xl"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.7 }}
                    />
                  )}
                  <t.icon size={16} className={`relative z-10 ${activeTab === t.id ? "text-white" : "text-slate-600"} transition-colors`} />
                  <span className="relative z-10">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 relative overflow-hidden">
              {/* Tabs Content */}
              <div className={activeTab === "overview" ? "block h-full overflow-y-auto scrollbar-hide pr-2" : "hidden"}>
                {datasetPayload ? <OverviewTab payload={datasetPayload} onSwitchTab={setActiveTab} /> : (
                  <EmptyState 
                    title="INTELLIGENCE" 
                    subtitle="WORKSPACE AWAITS"
                    desc="Upload a dataset to unlock AI-powered insights, forecasting, and conversational analytics."
                    icon={<Database size={40} className="text-indigo-400" />}
                    onUpload={() => fileInputRef.current?.click()}
                  />
                )}
              </div>

              <div className={activeTab === "analyst" ? "block h-full" : "hidden"}>
                {(!datasetPayload && !sessionDataset) ? (
                   <EmptyState 
                    title="INTELLIGENCE" 
                    subtitle="AWAITS ANALYSIS"
                    desc="Start a conversation with your data. Select a dataset from the library or upload a new one to begin."
                    icon={<MessageSquare size={40} className="text-indigo-400" />}
                    onUpload={() => fileInputRef.current?.click()}
                  />
                ) : (
                  <AIAnalyst 
                    payload={sessionDataset} user={user!} onSwitchToForecast={() => setActiveTab("forecast")} 
                    messages={messages} sendMessage={sendMessage} clearChat={clearChat}
                    isAnalyzing={isAnalyzing} chatError={chatError}
                    onDatasetRecovered={(newPayload) => { setSessionDataset(newPayload); setDatasetPayload(newPayload); }}
                    selectedReportIndices={selectedReportIndices} setSelectedReportIndices={setSelectedReportIndices}
                  />
                )}
              </div>

              <div className={activeTab === "forecast" ? "block h-full overflow-y-auto scrollbar-hide pr-2" : "hidden"}>
                {datasetPayload ? <ForecastingTab payload={datasetPayload} /> : (
                  <EmptyState 
                    title="INTELLIGENCE" 
                    subtitle="PREDICTIVE READY"
                    desc="Load your operational data to generate future trends and automated forecasts."
                    icon={<TrendingUp size={40} className="text-indigo-400" />}
                    onUpload={() => fileInputRef.current?.click()}
                  />
                )}
              </div>

              <div className={activeTab === "reports" ? "block h-full overflow-y-auto scrollbar-hide pr-2" : "hidden"}>
                <ReportsTab 
                  payload={datasetPayload} user={user} messages={messages} sendMessage={sendMessage}
                  isAnalyzing={isAnalyzing} chatError={chatError} activeSessionId={activeSessionId}
                  selectedReportIndices={selectedReportIndices} setSelectedReportIndices={setSelectedReportIndices}
                />
              </div>

              <div className={activeTab === "board" ? "block h-full overflow-y-auto scrollbar-hide pr-2" : "hidden"}>
                <LiveBoard isActive={activeTab === "board"} />
              </div>
            </div>

            {/* Hidden Input for Empty State CTA */}
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </main>
      </div>

      <ConfirmModal 
        isOpen={!!deleteSessionId} onClose={() => setDeleteSessionId(null)} onConfirm={performDeleteSession}
        title="Delete Chat Session" message="Permanently remove this conversation?" type="danger"
      />

      <ConfirmModal 
        isOpen={!!pendingDatasetToActivate} onClose={() => setPendingDatasetToActivate(null)} onConfirm={handleConfirmActivation}
        title="Switch Dataset?" message={`Switch to "${pendingDatasetToActivate?.filename}"?`} type="info"
      />
    </div>
  );
}

function EmptyState({ title, subtitle, desc, icon, onUpload }: { title: string, subtitle: string, desc: string, icon: React.ReactNode, onUpload: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8">
      <div className="relative mb-12 group">
        <div className="absolute inset-0 bg-indigo-600/30 blur-[80px] rounded-full group-hover:bg-indigo-600/40 transition-all duration-700" />
        <div className="relative w-28 h-28 glass-card-premium flex items-center justify-center border-white/10 shadow-2xl floating-hologram">
          {icon}
          {/* Pulsing Ring */}
          <div className="absolute inset-0 border border-indigo-500/30 rounded-full animate-[spin_10s_linear_infinite] opacity-40" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white border-2 border-[#030712] shadow-lg">
             <Sparkles size={14} />
          </div>
        </div>
      </div>
      
      <div className="mb-6 space-y-1">
        <h3 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none opacity-90">{title}</h3>
        <h4 className="text-4xl font-black text-indigo-400 tracking-tighter uppercase italic leading-none">{subtitle}</h4>
      </div>
      <p className="text-slate-500 max-w-sm text-base font-medium leading-relaxed mb-10 mx-auto">{desc}</p>
      
      <button 
        onClick={onUpload}
        className="group relative px-12 py-4 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] text-white shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95 transition-all animate-shine"
      >
        <div className="flex items-center gap-3 relative z-10">
           <Upload size={16} className="group-hover:animate-bounce" />
           <span>Upload Dataset</span>
        </div>
      </button>

      {/* Visual Accents */}
      <div className="mt-16 flex items-center gap-8 opacity-20">
         <div className="flex items-center gap-2"><Rocket size={14}/> <span className="text-[9px] font-black uppercase tracking-widest">Fast Processing</span></div>
         <div className="flex items-center gap-2"><ShieldCheck size={14}/> <span className="text-[9px] font-black uppercase tracking-widest">Enterprise Secure</span></div>
         <div className="flex items-center gap-2"><Activity size={14}/> <span className="text-[9px] font-black uppercase tracking-widest">Real-time Insights</span></div>
      </div>
    </motion.div>
  );
}

import { DataQualityGauge } from "@/components/DataQualityGauge";
import PlotlyChart from "@/components/PlotlyChart";

function OverviewTab({ payload, onSwitchTab }: { payload: DatasetPayload, onSwitchTab: (tab: Tab) => void }) {
  const [showAll, setShowAll] = useState(false);
  const { schema, kpis, insights, correlations, preview_rows: previewRows = [] } = payload;
  const displayedInsights = showAll ? insights : insights.slice(0, 4);

  const topRelationships = useMemo(() => {
    if (!correlations || !correlations.values) return [];
    const rels: { a: string; b: string; val: number; type: string }[] = [];
    const cols = correlations.columns;
    const vals = correlations.values;
    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < vals[i].length; j++) {
        const v = vals[i][j];
        if (Math.abs(v) > 0.6) rels.push({ a: cols[i], b: cols[j], val: v, type: v > 0 ? "positive" : "negative" });
      }
    }
    return rels.sort((a, b) => Math.abs(b.val) - Math.abs(a.val)).slice(0, 3);
  }, [correlations]);

  return (
    <div className="space-y-10 pb-20">
      <KPICards kpis={kpis} />
      
      {insights.length > 0 && (
        <section className="glass-card-premium p-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700">
             <Sparkles size={120} />
          </div>
          <div className="flex items-center gap-3 text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em] mb-10 relative z-10">
            <Sparkles size={16} /> Intelligence Briefing
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            {displayedInsights.map((ins, i) => (
              <motion.li 
                key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="text-[14px] text-slate-300 flex gap-5 p-6 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 text-xs font-black shrink-0 border border-indigo-500/20">
                  {i + 1}
                </div>
                <span className="leading-relaxed font-medium">{ins}</span>
              </motion.li>
            ))}
          </ul>
          {insights.length > 4 && (
            <button
              className="text-[10px] font-black text-indigo-400 mt-10 hover:text-white transition-all uppercase tracking-[0.3em] flex items-center gap-3 group/btn"
              onClick={() => setShowAll((v) => !v)}
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover/btn:bg-indigo-500 group-hover/btn:text-white transition-colors">
                 {showAll ? <ChevronRight size={14} className="-rotate-90" /> : <Plus size={14} />}
              </div>
              {showAll ? "Show Condensed View" : `Explore ${insights.length - 4} Additional Insights`}
            </button>
          )}
        </section>
      )}

      {correlations && correlations.columns.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <section className="lg:col-span-7 glass-card-premium p-10">
            <div className="flex items-center gap-3 text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em] mb-8">
              <LayoutDashboard size={16} /> Relationship Heatmap
            </div>
            <div className="h-[400px] w-full bg-black/40 rounded-[2rem] overflow-hidden border border-white/5 shadow-inner">
              <PlotlyChart 
                spec={{
                  data: [{ z: correlations.values, x: correlations.columns, y: correlations.columns, type: 'heatmap', colorscale: 'Viridis', showscale: true }],
                  layout: { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#64748B', size: 10 }, margin: { l: 80, r: 20, t: 20, b: 80 }, xaxis: { gridcolor: 'rgba(255,255,255,0.05)' }, yaxis: { gridcolor: 'rgba(255,255,255,0.05)' } }
                }}
                height={400}
              />
            </div>
          </section>

          <section className="lg:col-span-5 glass-card-premium p-10">
            <div className="flex items-center gap-3 text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em] mb-8">
              <TrendingUp size={16} /> Top Analytical Correlations
            </div>
            <div className="space-y-6">
              {topRelationships.map((rel, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all">
                   <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{rel.type} Relationship</span>
                      <span className="text-xs font-black text-white">{Math.round(rel.val * 100)}% Match</span>
                   </div>
                   <div className="flex items-center gap-4 text-sm font-bold text-white">
                      <span className="truncate">{rel.a}</span>
                      <ArrowRight size={14} className="text-indigo-500 shrink-0" />
                      <span className="truncate">{rel.b}</span>
                   </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
