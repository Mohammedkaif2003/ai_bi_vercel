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
  const [selectedPreloaded, setSelectedPreloaded] = useState("");
  const [newChatKey, setNewChatKey] = useState("new");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Check for recovery mode in URL (hash or query)
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

  // Unified Chat State (Shared across all tabs)
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

  // Optionally refresh sessions periodically or when tab changes
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
      
      // If we already have an active dataset and it's different, prompt
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
        
        const { error: uploadError } = await supabase.storage
          .from('user_datasets')
          .upload(storagePath, file);
          
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
      
      // If this session's dataset is different from the ACTIVE one, prompt to switch
      if (datasetPayload && datasetPayload.dataset_key !== payload.dataset_key) {
        setPendingDatasetToActivate(payload);
      } else if (!datasetPayload) {
        // If no active dataset, make this one active automatically? 
        // User said "if i go to history, it views and a pop up"
        // So let's always prompt if it's not already active.
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
    if (activeSessionId === deleteSessionId) {
      setActiveSessionId(null);
    }
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
      toast.success("Dataset activated", {
        description: `${pendingDatasetToActivate.filename} is now the active source.`
      });
      setPendingDatasetToActivate(null);
    }
  }

  const handleDiscoveryClick = (query: string) => {
    setActiveTab("analyst");
    sendMessage(query);
    setShowMobileMenu(false);
  };

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: "Data Overview", icon: Database },
    { id: "analyst", label: "AI Analyst", icon: MessageSquare },
    { id: "forecast", label: "Forecasting", icon: TrendingUp },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "board", label: "Live Board", icon: LayoutDashboard },
  ];




  return (
    <div 
      className="h-screen flex flex-col bg-mesh overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        // Prevent flickering when dragging over children
        if (e.relatedTarget === null) setIsDragging(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) await processFile(file);
      }}
    >
      <Head><title>{`Nexlytics | Dashboard`}</title></Head>

      <Toaster position="top-right" theme="dark" closeButton richColors />
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-indigo-900/20 backdrop-blur-xl border-[6px] border-dashed border-indigo-500/30 flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="p-16 rounded-[4rem] bg-[#030712]/90 border border-white/10 shadow-[0_0_100px_rgba(79,70,229,0.2)] flex flex-col items-center gap-8 text-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
                <div className="relative w-28 h-28 rounded-3xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <Upload size={48} className="animate-bounce" />
                </div>
              </div>
              <div>
                <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">Drop to Analyze</h2>
                <p className="text-lg text-slate-400 font-medium max-w-xs">
                  Release your CSV anywhere to start the intelligence engine
                </p>
              </div>
              <div className="flex gap-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-indigo-500/40 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CommandPalette 
        onSelectTab={(tab) => setActiveTab(tab as Tab)}
        datasets={availableDatasets}
        onSelectDataset={(key) => {
          setSelectedKeys([key]);
          handleLoadSelected([key]);
        }}
      />
        <div className="flex flex-1 overflow-hidden max-w-[1920px] mx-auto w-full h-full relative">
          {/* Mobile Overlay Sidebar */}
          <AnimatePresence>
            {showMobileMenu && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowMobileMenu(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
                />
                <motion.aside 
                  initial={{ x: -300 }}
                  animate={{ x: 0 }}
                  exit={{ x: -300 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="absolute top-0 left-0 bottom-0 w-72 bg-[#0B0F19] border-r border-white/[0.08] p-4 z-[70] md:hidden shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <LogoMark size={24} />
                    <button onClick={() => setShowMobileMenu(false)} className="text-slate-500 hover:text-white p-1">
                       <Plus size={20} className="rotate-45" />
                    </button>
                  </div>
                  <Sidebar 
                    onLoadSelected={handleLoadSelected}
                    onProcessFile={processFile}
                    onFileUpload={handleFileUpload}
                    onNewChat={handleNewChat}
                    onLoadSession={handleLoadSession}
                    onDeleteSession={handleDeleteSession}
                    onRenameSession={handleRenameSession}
                    onSignOut={handleSignOut}
                  />
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          <aside className={`${sidebarCollapsed ? "w-20" : "w-72"} bg-[#0B0F19]/50 border-r border-white/[0.08] p-4 shrink-0 hidden md:block backdrop-blur-md transition-all duration-300 relative`}>
              <Sidebar 
                onLoadSelected={handleLoadSelected}
                onProcessFile={processFile}
                onFileUpload={handleFileUpload}
                onNewChat={handleNewChat}
                onLoadSession={handleLoadSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                onSignOut={handleSignOut}
              />
          </aside>

          <main className="flex-1 h-full flex flex-col overflow-hidden p-4 md:p-5 custom-scrollbar">

            <div className="flex gap-2 mb-10 bg-black/40 p-1.5 rounded-2xl w-full border border-white/5 backdrop-blur-xl shadow-2xl overflow-x-auto custom-scrollbar pb-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`flex-1 shrink-0 min-w-[140px] flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold tracking-tight transition-all duration-300 relative whitespace-nowrap ${activeTab === t.id
                      ? "text-white"
                      : "text-slate-500 hover:text-slate-200"
                    }`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {activeTab === t.id && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <t.icon size={18} className="relative z-10" />
                  <span className="relative z-10">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 relative overflow-hidden">
              {/* Data Overview Tab */}
              <div className={activeTab === "overview" ? "block h-full overflow-y-auto custom-scrollbar pr-2" : "hidden"}>
                {datasetPayload ? (
                  <div className="space-y-6">
                
                    <OverviewTab 
                      payload={datasetPayload} 
                      onSwitchTab={setActiveTab} 
                    />
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center min-h-[60vh] text-center"
                  >
                    <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mb-6 border border-white/10">
                      <Database className="text-slate-400" size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Dataset Required</h3>
                    <p className="text-slate-400 max-w-md text-lg">Please load a dataset to view the overview.</p>
                  </motion.div>
                )}
              </div>

              {/* AI Analyst Tab (Always alive to preserve state) */}
              <div className={activeTab === "analyst" ? "block h-full" : "hidden"}>
                {(!datasetPayload && !sessionDataset) ? (
                   <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center min-h-[60vh] text-center"
                  >
                    <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/20">
                      <Database className="text-indigo-400" size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">What data do you want to analyze today?</h3>
                    <p className="text-slate-400 max-w-md text-lg">Use the sidebar to upload a CSV or select a dataset.</p>
                  </motion.div>
                ) : (
                  <AIAnalyst 
                    payload={sessionDataset} 
                    user={user!} 
                    onSwitchToForecast={() => setActiveTab("forecast")} 
                    messages={messages}
                    sendMessage={sendMessage}
                    clearChat={clearChat}
                    isAnalyzing={isAnalyzing}
                    chatError={chatError}
                    onDatasetRecovered={(newPayload) => {
                      setSessionDataset(newPayload);
                      setDatasetPayload(newPayload);
                    }}
                    selectedReportIndices={selectedReportIndices}
                    setSelectedReportIndices={setSelectedReportIndices}
                  />
                )}
              </div>

              {/* Forecasting Tab */}
              <div className={activeTab === "forecast" ? "block h-full overflow-y-auto custom-scrollbar pr-2" : "hidden"}>
                {datasetPayload ? <ForecastingTab payload={datasetPayload} /> : <p className="text-slate-400 text-center py-20">Load a dataset to use forecasting.</p>}
              </div>

              {/* Reports Tab */}
              <div className={activeTab === "reports" ? "block h-full overflow-y-auto custom-scrollbar pr-2" : "hidden"}>
                <ReportsTab 
                  payload={datasetPayload} 
                  user={user} 
                  messages={messages}
                  sendMessage={sendMessage}
                  isAnalyzing={isAnalyzing}
                  chatError={chatError}
                  activeSessionId={activeSessionId}
                  selectedReportIndices={selectedReportIndices}
                  setSelectedReportIndices={setSelectedReportIndices}
                />
              </div>

              {/* Live Board Tab */}
              <div className={activeTab === "board" ? "block h-full overflow-y-auto custom-scrollbar pr-2" : "hidden"}>
                <LiveBoard 
                  isActive={activeTab === "board"} 
                />
              </div>

              {/* Alerts Tab */}
              {/* Alerts/Knowledge/Integrations tabs removed */}
            </div>
          </main>
        </div>

        <ConfirmModal 
          isOpen={!!deleteSessionId}
          onClose={() => setDeleteSessionId(null)}
          onConfirm={performDeleteSession}
          title="Delete Chat Session"
          message="Are you sure you want to delete this conversation? This action cannot be undone and all insights will be permanently removed."
          confirmLabel="Delete Permanently"
          type="danger"
        />

        <ConfirmModal 
          isOpen={!!pendingDatasetToActivate}
          onClose={() => setPendingDatasetToActivate(null)}
          onConfirm={handleConfirmActivation}
          title="Switch Active Dataset?"
          message={datasetPayload 
            ? `You are currently using "${datasetPayload.filename}". Would you like to switch to "${pendingDatasetToActivate?.filename}" for new analysis?`
            : `Would you like to set "${pendingDatasetToActivate?.filename}" as your active dataset for new analysis?`
          }
          confirmLabel="Yes, Switch Dataset"
          cancelLabel="No, Stay on Current"
          type="info"
        />
      </div>
  );
}

import { DataQualityGauge } from "@/components/DataQualityGauge";
import PlotlyChart from "@/components/PlotlyChart";

function OverviewTab({ 
  payload, 
  onSwitchTab 
}: { 
  payload: DatasetPayload, 
  onSwitchTab: (tab: Tab) => void 
}) {
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const { schema, kpis, insights, health_score, correlations, preview_rows: previewRows = [] } = payload;

  // Reset state and detect columns when dataset changes
  useEffect(() => {
    setVisibleColumns(schema.column_names);
    setPreviewData(previewRows);
    setPage(1);
    setTotalPages(Math.ceil(schema.rows / 100));
  }, [payload.dataset_key, schema.column_names, previewRows, schema.rows]);

  const [showColPicker, setShowColPicker] = useState(false);

  const displayedInsights = showAll ? insights : insights.slice(0, 4);

  // Derive human-readable insights from the correlation matrix
  const topRelationships = useMemo(() => {
    if (!correlations || !correlations.values) return [];
    const rels: { a: string; b: string; val: number; type: string }[] = [];
    const cols = correlations.columns;
    const vals = correlations.values;

    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < vals[i].length; j++) {
        const v = vals[i][j];
        if (Math.abs(v) > 0.6) {
          rels.push({
            a: cols[i],
            b: cols[j],
            val: v,
            type: v > 0 ? "positive" : "negative"
          });
        }
      }
    }
    return rels.sort((a, b) => Math.abs(b.val) - Math.abs(a.val)).slice(0, 3);
  }, [correlations]);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => 
      prev.includes(col) 
        ? prev.filter(c => c !== col) 
        : [...prev, col]
    );
  };

  // Server-side search & pagination
  const fetchPage = useCallback(async (p: number) => {
    setIsLoadingData(true);
    try {
      const { results, total_pages } = await searchDataset(payload.dataset_key, "", p, 100, {});
      setPreviewData(results);
      setTotalPages(total_pages);
    } catch (err) {
      console.error("Fetch page failed:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [payload.dataset_key]);



  useEffect(() => {
    if (page > 1) {
       fetchPage(page);
    }
  }, [page, fetchPage]); 

  const filteredRows = previewData;
  const currentMatchCount = schema.rows;

  const getRowValue = (row: any, col: string) => {
    if (row[col] !== undefined && row[col] !== null) return String(row[col]);
    const key = Object.keys(row).find(k => k.toLowerCase() === col.toLowerCase());
    return (key && row[key] !== null) ? String(row[key]) : "";
  };

return (
    <div className="space-y-8">
      {/* Top Row: AI Narrative & Health */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-12 space-y-8">
          <KPICards kpis={kpis} />
          
          {insights.length > 0 && (
            <section className="card p-8">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-[0.2em] mb-6">
                <Sparkles size={14} /> Intelligence Briefing
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedInsights.map((ins, i) => (
                  <motion.li 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="text-[15px] text-slate-300 flex gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <span>{ins}</span>
                  </motion.li>
                ))}
              </ul>
              {insights.length > 4 && (
                <button
                  className="text-xs font-bold text-indigo-400 mt-6 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-2"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? "Show less" : `+ View ${insights.length - 4} more insights`}
                </button>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Relationships & Heatmap */}
      {correlations && correlations.columns.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-7 card p-8">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-[0.2em] mb-6">
              <LayoutDashboard size={14} /> Relationship Heatmap
            </div>
            <div className="h-[400px] w-full bg-black/20 rounded-[2rem] overflow-hidden border border-white/5">
              <PlotlyChart 
                spec={{
                  data: [{
                    z: correlations.values,
                    x: correlations.columns,
                    y: correlations.columns,
                    type: 'heatmap',
                    colorscale: 'Viridis',
                    showscale: true,
                    hovertemplate: 'X: %{x}<br>Y: %{y}<br>Correlation: %{z:.2f}<extra></extra>',
                  }],
                  layout: {
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#64748B', size: 10 },
                    margin: { l: 80, r: 20, t: 20, b: 80 },
                    xaxis: { gridcolor: 'rgba(255,255,255,0.05)' },
                    yaxis: { gridcolor: 'rgba(255,255,255,0.05)' }
                  }
                }}
                height={400}
              />
            </div>
          </section>

          <section className="lg:col-span-5 card p-8">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-[0.2em] mb-6">
              <TrendingUp size={14} /> Key Relationships
            </div>
            <div className="space-y-4">
              {topRelationships.length > 0 ? (
                topRelationships.map((rel, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <p className="text-sm font-bold text-white mb-1">
                      {rel.a} & {rel.b}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      These two metrics have a <span className={rel.type === 'positive' ? 'text-emerald-400' : 'text-rose-400'}>
                        {Math.abs(rel.val) > 0.8 ? 'very strong' : 'strong'} {rel.type}
                      </span> relationship. When one changes, the other tends to follow.
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">No strong linear relationships detected in this sample.</p>
              )}
            </div>
            <div className="mt-8 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-[11px] text-slate-400 leading-relaxed">
              <p className="font-bold text-indigo-400 mb-1 flex items-center gap-1">
                <HelpCircle size={12} /> Understanding Correlations
              </p>
              Correlation values range from -1 to +1. A value of +1 means perfect synchronization, while 0 means no relationship at all.
            </div>
          </section>
        </div>
      )}

      {/* Column Explorer */}
      <section className="card p-8">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-[0.2em] mb-6">
          <Library size={14} /> Data Dictionary
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schema.column_names.map((col) => {
            const isNumeric = schema.numeric_columns.includes(col);
            const isCat = schema.categorical_columns.includes(col);
            const isTime = schema.datetime_columns.includes(col);
            const sample = previewRows[0]?.[col];
            
            return (
              <div key={col} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white truncate mr-2">{col}</span>
                  <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-md ${
                    isNumeric ? "bg-emerald-500/10 text-emerald-400" :
                    isCat ? "bg-indigo-500/10 text-indigo-400" :
                    isTime ? "bg-amber-500/10 text-amber-400" :
                    "bg-white/5 text-slate-500"
                  }`}>
                    {isNumeric ? "Numeric" : isCat ? "Category" : isTime ? "Date/Time" : "Text"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  Example: <span className="text-slate-400">{String(sample ?? "N/A")}</span>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Advanced Data Explorer */}
      <section className="card overflow-hidden border border-white/10 shadow-2xl relative">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-white/5 z-30">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (page * 100 * 100) / schema.rows)}%` }}
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
          />
        </div>

        <div className="p-8 border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0F172A]/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-[0.2em] mb-1">
              <Database size={14} /> Professional Data Preview
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Live Preview · {schema.rows.toLocaleString()} Rows · {visibleColumns.length} columns · Page {page} of {totalPages}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2 py-1 mr-2">
                <button 
                  disabled={page <= 1 || isLoadingData}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-400"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[11px] font-bold text-slate-400 min-w-[3rem] text-center">
                  {page} / {totalPages}
                </span>
                <button 
                  disabled={page >= totalPages || isLoadingData}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-400"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <div className="relative">
              <button 
                onClick={() => setShowColPicker(!showColPicker)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                  showColPicker 
                    ? "bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20" 
                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                }`}
              >
                <Filter size={14} />
                Column Manager
              </button>

              <AnimatePresence>
                {showColPicker && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl z-50 p-4"
                  >
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Columns</span>
                      <button 
                        onClick={() => setVisibleColumns(schema.column_names)}
                        className="text-[11px] font-bold text-indigo-400 hover:text-white"
                      >
                        Select All
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto scrollbar-hide space-y-1">
                      {schema.column_names.map(col => (
                        <label 
                          key={col} 
                          className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                        >
                          <input 
                            type="checkbox" 
                            checked={visibleColumns.includes(col)}
                            onChange={() => toggleColumn(col)}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-transparent text-indigo-500 focus:ring-0 focus:ring-offset-0"
                          />
                          <span className="text-[11px] text-slate-300 font-medium truncate">{col}</span>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>


          </div>
        </div>
        
        <div className="max-h-[600px] overflow-x-auto overflow-y-auto border-t border-white/5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {filteredRows.length > 0 && visibleColumns.length > 0 ? (
            <table className="w-full text-[11px] text-left border-collapse table-auto">
              <thead className="sticky top-0 z-10 bg-[#0F172A] shadow-xl">
                <tr className="bg-white/[0.02]">
                  {visibleColumns.map((col) => (
                    <th key={col} className="py-4 px-6 text-slate-500 font-bold uppercase tracking-widest border-b border-white/10 whitespace-nowrap min-w-[150px] bg-[#0F172A]">
                      <span className="text-white font-black">{col}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filteredRows.map((row, ri) => (
                    <motion.tr 
                      key={`${page}-${ri}`} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors group"
                    >
                      {visibleColumns.map((col) => (
                        <td key={col} className="py-3 px-6 text-slate-300 whitespace-nowrap border-r border-white/[0.05] last:border-0 font-medium bg-[#0F172A]/30">
                          <span className="group-hover:text-indigo-300 transition-colors">
                            {getRowValue(row, col)}
                          </span>
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          ) : (
            <div className="py-40 text-center text-slate-500 italic text-sm">
              {isLoadingData ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                    <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={16} />
                  </div>
                  <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">Loading data...</p>
                </div>
              ) : visibleColumns.length === 0 ? (
                "Open the Column Manager to select data fields."
              ) : (
                "No records to display."
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
