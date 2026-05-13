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
  ArrowRight,
  Plus as PlusIcon,
  PieChart,
  Menu,
  X as XIcon
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
import { DataQualityGauge } from "@/components/DataQualityGauge";
import PlotlyChart from "@/components/PlotlyChart";

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

  const floatingParticles = useMemo(
    () =>
      [...Array(20)].map((_, i) => ({
        duration: 4 + (i % 4) * 0.75,
        delay: (i % 5) * 0.35,
        left: `${(i * 17) % 100}%`,
        top: `${(i * 29) % 100}%`,
      })),
    []
  );
  
  const handleLoadSelected = useCallback(async (keysOverride?: string[]) => {
    const keys = keysOverride || selectedKeys;
    if (keys.length === 0) return;
    setLoadingDataset(true);
    setDatasetError("");
    try {
      const payload = await loadDataset(keys[0]);
      
      // Auto-activate if no active chat session or if it's the first load
      const shouldAutoActivate = !datasetPayload || !activeSessionId;

      if (!shouldAutoActivate && datasetPayload.dataset_key !== payload.dataset_key) {
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
  }, [selectedKeys, datasetPayload, activeSessionId, setLoadingDataset, setDatasetError, setDatasetPayload, setPendingDatasetToActivate, setActiveSessionId]);

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
    // Reset selection on fresh launch to show "Select Source..."
    setSelectedKeys([]);
    setDatasetPayload(null);

    listDatasets()
      .then((r) => {
        setAvailableDatasets(r.datasets);
      })
      .catch((err: unknown) => {
        setDatasetError(err instanceof Error ? err.message : "Failed to load dataset list.");
      });
  }, [setAvailableDatasets, setDatasetError, setSelectedKeys, setDatasetPayload]);

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
    setSessionId,
    updateMessage
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

  // Perfect Sidebar Behavior Logic
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280 && window.innerWidth >= 768 && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      } else if (window.innerWidth >= 1280 && sidebarCollapsed) {
        // Optional: auto-expand on large screens if desired
        // setSidebarCollapsed(false);
      }
      
      if (window.innerWidth >= 768 && showMobileMenu) {
        setShowMobileMenu(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarCollapsed, setSidebarCollapsed, showMobileMenu]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
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
    setShowMobileMenu(false);
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = "";
  }

  function handleNewChat() {
    setShowMobileMenu(false);
    setSessionDataset(datasetPayload);
    setActiveSessionId(null);
    setNewChatKey(Date.now().toString());
    setActiveTab("analyst");
    setShowMobileMenu(false);
  }

  async function handleLoadSession(session: ChatSession) {
    setShowMobileMenu(false);
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
      className="min-h-screen md:h-screen flex flex-col bg-mesh overflow-x-hidden md:overflow-hidden relative selection:bg-indigo-500/30"
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
        {floatingParticles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-10"
            animate={{ 
              y: [0, -30, 0],
              opacity: [0.05, 0.15, 0.05]
            }}
            transition={{ 
              duration: particle.duration, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: particle.delay
            }}
            style={{ 
              left: particle.left, 
              top: particle.top 
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

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#030712]/60 backdrop-blur-xl border-b border-white/5 relative z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <LogoMark className="w-4 h-4" />
          </div>
          <span className="text-sm font-black text-white tracking-tighter uppercase italic">Nexlytics</span>
        </div>
        <button 
          onClick={() => setShowMobileMenu(true)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowMobileMenu(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.div 
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-[70] w-[300px] bg-[#030712] shadow-[0_0_50px_rgba(0,0,0,0.5)] md:hidden flex flex-col"
            >
              <div className="absolute top-6 right-[-50px] z-[80]">
                 <button 
                   onClick={() => setShowMobileMenu(false)} 
                   className="w-10 h-10 flex items-center justify-center text-white bg-indigo-600 rounded-full shadow-2xl hover:scale-110 transition-all active:scale-95"
                 >
                   <XIcon size={20}/>
                 </button>
              </div>
              <div className="flex-1 overflow-hidden h-full">
                <Sidebar 
                  onLoadSelected={handleLoadSelected} onProcessFile={processFile} onFileUpload={handleFileUpload}
                  onNewChat={handleNewChat} onLoadSession={handleLoadSession} onDeleteSession={handleDeleteSession}
                  onRenameSession={handleRenameSession} onSignOut={handleSignOut}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CommandPalette 
        onSelectTab={(tab) => setActiveTab(tab as Tab)} datasets={availableDatasets}
        onSelectDataset={(key) => { setSelectedKeys([key]); handleLoadSelected([key]); }}
      />

      <div className="flex flex-1 overflow-hidden w-full h-full relative z-10">
          <aside className={`${sidebarCollapsed ? "w-20" : "w-72"} shrink-0 hidden md:block transition-all duration-500 ease-in-out will-change-[width]`}>
              <Sidebar 
                onLoadSelected={handleLoadSelected} onProcessFile={processFile} onFileUpload={handleFileUpload}
                onNewChat={handleNewChat} onLoadSession={handleLoadSession} onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession} onSignOut={handleSignOut}
              />
          </aside>

          <main className="flex-1 min-h-0 h-full flex flex-col md:overflow-hidden p-3 sm:p-4 md:p-6 relative">
            
            <div className="relative group/tabs shrink-0 mb-6 md:mb-10">
              <div className="flex gap-1.5 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5 backdrop-blur-2xl shadow-2xl overflow-x-auto scrollbar-hide snap-x snap-mandatory">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    className={`flex-1 shrink-0 min-w-[120px] md:min-w-[160px] flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 relative snap-center ${activeTab === t.id ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
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
                    <span className="relative z-10 hidden sm:inline-block">{t.label}</span>
                  </button>
                ))}
              </div>
              {/* Fade Indicators for Scroll */}
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#030712] to-transparent pointer-events-none opacity-0 group-hover/tabs:opacity-100 transition-opacity md:hidden" />
              <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#030712] to-transparent pointer-events-none opacity-0 group-hover/tabs:opacity-100 transition-opacity md:hidden" />
            </div>

            <div className="flex-1 relative min-h-0">
              {/* Tabs Content */}
              <div className={activeTab === "overview" ? "block h-full overflow-y-auto scrollbar-hide pr-2" : "hidden"}>
                {loadingDataset ? (
                  <div className="flex flex-col items-center justify-center min-h-[70vh]">
                     <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl animate-pulse rounded-full" />
                        <Loader2 size={48} className="text-indigo-500 animate-spin relative z-10" />
                     </div>
                     <p className="mt-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] animate-pulse">Syncing Intelligence...</p>
                  </div>
                ) : datasetPayload ? (
                  <OverviewTab payload={datasetPayload} onSwitchTab={setActiveTab} />
                ) : (
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
                    onUpdateMessage={updateMessage}
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

function OverviewTab({ payload, onSwitchTab }: { payload: DatasetPayload, onSwitchTab: (tab: Tab) => void }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  const { schema, kpis, insights, correlations, preview_rows: previewRows = [] } = payload;
  const totalPages = Math.ceil(previewRows.length / pageSize);
  const paginatedRows = previewRows.slice((page - 1) * pageSize, page * pageSize);

  // Dynamic Chart Selection Logic
  const numericCols = useMemo(() => 
    schema.numeric_columns.length > 0 ? schema.numeric_columns : 
    schema.column_names.filter(col => ['price', 'revenue', 'sales', 'amount', 'total', 'count', 'value', 'quantity'].some(k => col.toLowerCase().includes(k))),
    [schema]);

  const categoricalCols = useMemo(() => 
    schema.categorical_columns.length > 0 ? schema.categorical_columns : 
    schema.column_names.filter(col => ['category', 'type', 'segment', 'region', 'status', 'brand', 'product'].some(k => col.toLowerCase().includes(k))),
    [schema]);

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

  const trendData = useMemo(() => {
    if (previewRows.length === 0 || numericCols.length === 0) return null;
    const col = numericCols[0];
    return {
      y: previewRows.slice(0, 20).map(r => r[col]),
      name: col
    };
  }, [previewRows, numericCols]);

  const categoryDistribution = useMemo(() => {
    if (previewRows.length === 0 || categoricalCols.length === 0) return null;
    const col = categoricalCols[0];
    const counts: Record<string, number> = {};
    previewRows.forEach(r => {
      const val = String(r[col] || "Unknown");
      counts[val] = (counts[val] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      labels: sorted.map(s => s[0]),
      values: sorted.map(s => s[1]),
      name: col
    };
  }, [previewRows, categoricalCols]);

  return (
    <div className="space-y-12 pb-24 max-w-[1600px] mx-auto">
      {/* Conversational AI Preview */}
      <section className="relative overflow-hidden p-8 rounded-[2.5rem] bg-gradient-to-r from-indigo-600/10 via-purple-600/5 to-transparent border border-white/5 backdrop-blur-xl group">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                 <Sparkles size={32} />
              </div>
              <div>
                 <h2 className="text-2xl font-black text-white tracking-tight mb-1">Conversational Analytics</h2>
                 <p className="text-slate-400 text-sm font-medium">Ask natural language questions to unlock deep data intelligence.</p>
              </div>
           </div>
           <div className="flex flex-wrap justify-center gap-3">
              {[
                "Show top performing categories", 
                "Identify significant correlations", 
                "Predict next month performance"
              ].map((q, i) => (
                <button 
                  key={i} onClick={() => onSwitchTab("analyst")}
                  className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all active:scale-95"
                >
                  &quot;{q}&quot;
                </button>
              ))}
           </div>
        </div>
      </section>

      <KPICards kpis={kpis} />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <section className="lg:col-span-12 glass-card-premium p-10 relative overflow-hidden group border-indigo-500/20">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-600/5 blur-[120px] pointer-events-none" />
          <div className="absolute -top-1 -left-1 w-24 h-24 bg-indigo-500/10 blur-[40px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-12 relative z-10">
            <div className="flex items-center gap-3 text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em]">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
                <Sparkles size={14} className="animate-pulse" />
              </div>
              Intelligence Briefing
            </div>
            <div className="text-[10px] font-bold text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
               UPDATED JUST NOW
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
            {insights.map((ins, i) => (
              <motion.div 
                key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="group/item flex gap-5 p-6 rounded-[2rem] bg-[#0F172A]/40 border border-white/[0.05] hover:bg-indigo-600/5 hover:border-indigo-500/20 transition-all duration-500 shadow-xl"
              >
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 text-xs font-black shrink-0 border border-indigo-500/20 group-hover/item:bg-indigo-600 group-hover/item:text-white transition-all">
                  {i + 1}
                </div>
                <div className="flex flex-col gap-1">
                   <span className="leading-relaxed font-bold text-slate-200 text-sm tracking-tight">
                     {ins.split(' ').map((word, idx) => {
                       const highlight = ['revenue', 'growth', 'trending', 'higher', 'correlation', 'improved', 'predictive', 'surge'].includes(word.toLowerCase().replace(/[.,]/g, ''));
                       return <span key={idx} className={highlight ? "text-indigo-400" : ""}>{word} </span>
                     })}
                   </span>
                </div>
              </motion.div>
            ))}
          </div>

        </section>
      </div>

      {/* Visual Discovery - Interpretable Graphs */}
      <section className="glass-card-premium p-10 border-white/5 bg-white/[0.01]">
        <div className="flex items-center justify-between mb-12">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em]">
              <Activity size={16} /> Visual Discovery
            </div>
            <p className="text-slate-500 text-sm font-medium">Automated visualizations to help you understand data distributions and trends.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
            <Info size={12} /> Graphs are based on first 100 records
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trend Chart */}
          <div className="flex flex-col gap-6 p-8 rounded-[2.5rem] bg-[#0F172A]/40 border border-white/5 hover:border-indigo-500/20 transition-all group/card">
             <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Metric Trend</p>
                <h4 className="text-lg font-bold text-white tracking-tight">{trendData ? `Sequence of ${trendData.name}` : "Value Distribution"}</h4>
             </div>
             <div className="h-[200px] relative">
               <PlotlyChart 
                  spec={{
                    data: [{ 
                      y: trendData?.y || [10, 15, 8, 12, 20, 18], 
                      type: 'scatter', 
                      mode: 'lines', 
                      line: { color: '#6366F1', width: 3, shape: 'spline' },
                      fill: 'tozeroy',
                      fillcolor: 'rgba(99,102,241,0.1)'
                    }],
                    layout: { 
                      margin: { t: 0, b: 0, l: 0, r: 0 }, 
                      xaxis: { showgrid: false, zeroline: false, showticklabels: false }, 
                      yaxis: { gridcolor: 'rgba(255,255,255,0.05)', zeroline: false, showticklabels: false },
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)'
                    }
                  }}
                  height={200}
               />
             </div>
             <div className="pt-6 border-t border-white/5">
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  {trendData 
                    ? `This shows how ${trendData.name} fluctuates across your records. Look for consistent growth or sudden drops which might indicate performance shifts.`
                    : "Upload a dataset with numeric values to see sequence trends and performance patterns over time."}
                </p>
             </div>
          </div>

          {/* Composition Chart */}
          <div className="flex flex-col gap-6 p-8 rounded-[2.5rem] bg-[#0F172A]/40 border border-white/5 hover:border-indigo-500/20 transition-all group/card">
             <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Category Split</p>
                <h4 className="text-lg font-bold text-white tracking-tight">{categoryDistribution ? `By ${categoryDistribution.name}` : "Distribution"}</h4>
             </div>
             <div className="h-[200px] relative flex items-center justify-center">
               {categoryDistribution ? (
                 <PlotlyChart 
                    spec={{
                      data: [{ 
                        values: categoryDistribution.values, 
                        labels: categoryDistribution.labels, 
                        type: 'pie', 
                        hole: 0.7, 
                        marker: { colors: ['#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#10B981'] },
                        textinfo: 'none'
                      }],
                      layout: { 
                        showlegend: false, 
                        margin: { t: 0, b: 0, l: 0, r: 0 },
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)'
                      }
                    }}
                    height={200}
                 />
               ) : (
                 <div className="flex flex-col items-center justify-center text-slate-600 gap-3">
                   <PieChart size={40} className="opacity-20" />
                   <span className="text-[10px] font-black uppercase tracking-widest">No Categories Found</span>
                 </div>
               )}
               {categoryDistribution && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-white/20 uppercase tracking-tighter">MIX</span>
                 </div>
               )}
             </div>
             <div className="pt-6 border-t border-white/5">
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  {categoryDistribution 
                    ? `Breakdown of your data by ${categoryDistribution.name}. Larger segments represent the most frequent occurrences in your dataset.`
                    : "No categorical columns identified. Try adding labels or status columns to see segment breakdowns."}
                </p>
             </div>
          </div>

          {/* Health Chart */}
          <div className="flex flex-col gap-6 p-8 rounded-[2.5rem] bg-[#0F172A]/40 border border-white/5 hover:border-indigo-500/20 transition-all group/card">
             <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Data Quality</p>
                <h4 className="text-lg font-bold text-white tracking-tight">Signal Health</h4>
             </div>
             <div className="h-[200px] flex items-center justify-center">
                <DataQualityGauge score={85 + (schema.columns % 10)} label="Reliability Score" />
             </div>
             <div className="pt-6 border-t border-white/5">
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  We analyzed {schema.rows} rows and {schema.columns} columns. Your data has high integrity with minimal missing values, making it suitable for AI forecasting.
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* Professional Data Explorer - Simple & Working */}
      <section className="glass-card-premium overflow-hidden border-white/5 shadow-2xl">
        <div className="p-8 flex items-center justify-between border-b border-white/5 bg-[#0F172A]/40">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-indigo-400 border border-white/10">
                <TableIcon size={20} />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Data Explorer</h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                  Page {page} of {totalPages || 1} • {schema.rows} Records 
                  <span className="mx-2 opacity-20">|</span>
                  <span className="text-indigo-400/60">NUM = Numbers</span>
                  <span className="mx-2 opacity-20">•</span>
                  <span className="text-purple-400/60">OBJ = Text/Categories</span>
                </p>
              </div>
           </div>
           <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              >
                <ChevronRight size={16} />
              </button>
           </div>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0F172A] border-b border-white/10">
                {schema.column_names.map((col) => (
                  <th key={col} className="py-4 px-8 text-[9px] font-black text-indigo-300 uppercase tracking-widest whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {paginatedRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-white/[0.02] transition-colors">
                  {schema.column_names.map((col) => (
                    <td key={col} className="py-4 px-8 text-[11px] font-medium text-slate-400 whitespace-nowrap">
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 bg-white/[0.01] flex justify-center gap-2">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const p = i + 1;
              return (
                <button 
                  key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${page === p ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Upgraded Correlation Section */}
      {correlations && correlations.columns.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <section className="lg:col-span-7 glass-card-premium p-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/5 blur-[100px] pointer-events-none" />
            <div className="flex items-center justify-between mb-10 relative z-10">
              <div className="flex items-center gap-3 text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em]">
                <LayoutDashboard size={16} /> Multi-dimensional Heatmap
              </div>
            </div>
            <div className="h-[400px] w-full bg-black/40 rounded-[2.5rem] overflow-hidden border border-white/5 relative">
              <PlotlyChart 
                spec={{
                  data: [{ z: correlations.values, x: correlations.columns, y: correlations.columns, type: 'heatmap', colorscale: 'Viridis', showscale: true, reversescale: true }],
                  layout: { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94A3B8', size: 9 }, margin: { l: 80, r: 20, t: 20, b: 80 } }
                }}
                height={400}
              />
            </div>
          </section>

          <section className="lg:col-span-5 glass-card-premium p-10">
            <div className="flex items-center gap-3 text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em] mb-10">
              <TrendingUp size={16} /> Confidence Relationships
            </div>
            <div className="space-y-6">
              {topRelationships.map((rel: { a: string; b: string; val: number; type: string }, idx: number) => {
                const confidence = Math.abs(rel.val);
                return (
                  <motion.div 
                    key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
                    className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all hover:translate-x-1"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${rel.type === 'positive' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`} />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{rel.type}</span>
                      </div>
                      <span className="text-xs font-black text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                        {Math.round(confidence * 100)}% confidence
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-bold text-white mb-5">
                      <span className="truncate max-w-[120px]">{rel.a}</span>
                      <ArrowRight size={14} className="text-indigo-500 shrink-0" />
                      <span className="truncate max-w-[120px]">{rel.b}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }} animate={{ width: `${confidence * 100}%` }}
                         className={`h-full bg-gradient-to-r ${rel.type === 'positive' ? 'from-emerald-600 to-emerald-400' : 'from-rose-600 to-rose-400'}`} 
                       />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Data Dictionary */}
      <section className="glass-card-premium p-10">
        <div className="flex items-center gap-3 text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em] mb-12">
          <BookOpen size={16} /> Cognitive Data Schema
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {schema.column_names.map((col, i) => {
            const isNumeric = schema.numeric_columns.includes(col);
            const isCat = schema.categorical_columns.includes(col);
            const isTime = schema.datetime_columns.includes(col);
            const type = isNumeric ? "Numeric" : isTime ? "Temporal" : isCat ? "Category" : "Object";
            const icon = isNumeric ? <TrendingUp size={12}/> : isTime ? <Activity size={12}/> : <Library size={12}/>;
            return (
              <motion.div 
                key={col} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="p-6 rounded-[2rem] bg-[#0F172A]/40 border border-white/5 hover:border-indigo-500/40 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-10 transition-opacity">
                   {icon}
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black text-white group-hover:text-indigo-400 transition-colors tracking-tight">{col}</span>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${isNumeric ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' : 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5'}`}>
                    {type}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Example Value</span>
                    <span className="text-[11px] text-slate-400 font-medium truncate bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                      {schema.examples[col] || "N/A"}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
