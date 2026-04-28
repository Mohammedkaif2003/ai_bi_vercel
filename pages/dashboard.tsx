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
import { CommandPalette } from "@/components/CommandPalette";
import { Toaster, toast } from "sonner";

type Tab = "overview" | "analyst" | "forecast" | "reports" | "board";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  
  const [availableDatasets, setAvailableDatasets] = useState<DatasetInfo[]>([]);
  const [dataSource, setDataSource] = useState<"upload" | "preloaded">("preloaded");
  const [datasetPayload, setDatasetPayload] = useState<DatasetPayload | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  
  const [sessionDataset, setSessionDataset] = useState<DatasetPayload | null>(null);
  const [loadingDataset, setLoadingDataset] = useState(false);
  const [datasetError, setDatasetError] = useState("");
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [selectedPreloaded, setSelectedPreloaded] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [newChatKey, setNewChatKey] = useState("new");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    listDatasets()
      .then((r) => {
        setAvailableDatasets(r.datasets);
        if (r.datasets.length > 0) setSelectedKeys([r.datasets[0].key]);
      })
      .catch((err: unknown) => {
        setDatasetError(err instanceof Error ? err.message : "Failed to load dataset list.");
      });
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setChatSessions(data as ChatSession[]);
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Unified Chat State (Shared across all tabs)
  const {
    messages,
    isLoading: isAnalyzing,
    error: chatError,
    sendMessage,
    clearChat,
    setSessionId
  } = useChat({
    user,
    datasetKey: datasetPayload?.dataset_key,
    datasetName: datasetPayload?.filename,
    initialSessionId: activeSessionId,
    onSessionCreated: (session) => {
      setActiveSessionId(session.id);
      setChatSessions((prev) => [session, ...prev]);
    }
  });

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

  async function handleLoadSelected() {
    if (selectedKeys.length === 0) return;
    setLoadingDataset(true);
    setDatasetError("");
    try {
      const payload = await loadDataset(selectedKeys[0]);
      setDatasetPayload(payload);
      setSessionDataset(payload);
      setActiveSessionId(null);
      setNewChatKey(Date.now().toString());
      toast.success(`Dataset "${payload.filename}" loaded successfully!`, {
        description: `${payload.shape[0].toLocaleString()} rows and ${payload.shape[1]} columns processed.`,
        icon: <Database size={16} className="text-emerald-400" />
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dataset.";
      setDatasetError(msg);
      toast.error("Loading failed", { description: msg });
    } finally {
      setLoadingDataset(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingDataset(true);
    setDatasetError("");
    try {
      const b64 = await fileToBase64(file);
      const payload = await uploadCsv(b64, file.name);
      setDatasetPayload(payload);
      setSessionDataset(payload);
      setActiveSessionId(null);
      setNewChatKey(Date.now().toString());
      toast.success("File uploaded successfully", {
        description: `${file.name} is now active.`,
        icon: <Upload size={16} className="text-emerald-400" />
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload file.";
      setDatasetError(msg);
      toast.error("Upload failed", { description: msg });
    } finally {
      setLoadingDataset(false);
      e.target.value = "";
    }
  }

  function handleNewChat() {
    setSessionDataset(datasetPayload);
    setActiveSessionId(null);
    setNewChatKey(Date.now().toString());
    setActiveTab("analyst");
  }

  async function handleLoadSession(session: ChatSession) {
    const keyToLoad = session.dataset_key || session.dataset_name;
    if (!keyToLoad) return;
    
    setLoadingDataset(true);
    setDatasetError("");
    try {
      const payload = await loadDataset(keyToLoad);
      setSessionDataset(payload);
      setDatasetPayload(payload); // Also set global dataset if possible
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dataset.";
      if (msg.includes("not found")) {
        // Allow loading the session history even if the dataset is missing
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

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: "Data Overview", icon: Database },
    { id: "analyst", label: "AI Analyst", icon: MessageSquare },
    { id: "forecast", label: "Forecasting", icon: TrendingUp },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "board", label: "Live Board", icon: LayoutDashboard },
  ];

  return (
    <>
      <Head><title>{`Nexlytics | Dashboard`}</title></Head>
      <CommandPalette 
        onSelectTab={(tab) => setActiveTab(tab as Tab)}
        datasets={availableDatasets}
        onSelectDataset={(key) => {
          setSelectedKeys([key]);
          handleLoadSelected();
        }}
      />
      <Toaster position="top-right" theme="dark" closeButton richColors />
      <div className="h-screen flex flex-col bg-mesh overflow-hidden">
        <header className="h-[80px] bg-[#030712]/60 backdrop-blur-2xl border-b border-white/[0.05] px-8 flex items-center gap-6 z-50 shrink-0">
          <div className="max-w-[1920px] mx-auto w-full flex items-center gap-6">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 cursor-pointer"
            onClick={() => router.push("/")}
          >
            <LogoMark size={36} />
            <span className="font-bold text-white text-2xl tracking-tighter">Nexlytics</span>
          </motion.div>
          <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 hidden sm:flex">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
              v2.0 PRO
            </span>
          </div>
          <div className="ml-auto flex items-center gap-6">
            {user && (
              <div className="hidden md:flex flex-col items-end gap-0.5">
                <span className="text-white text-sm font-bold tracking-tight">{user.display_name}</span>
                <span className="text-indigo-400/80 text-[10px] font-bold uppercase tracking-[0.15em]">{user.role}</span>
              </div>
            )}

            <button
              onClick={handleSignOut}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/20 transition-all active:scale-95 text-sm font-semibold"
            >
              <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden max-w-[1920px] mx-auto w-full h-[calc(100vh-80px)]">
          <aside className="w-72 bg-[#0B0F19]/50 border-r border-white/[0.08] p-4 flex flex-col gap-4 overflow-y-auto shrink-0 hidden md:flex backdrop-blur-md custom-scrollbar">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4">
                Data Management
              </p>
              <div className="flex p-1 bg-white/[0.05] rounded-xl mb-4">
                <button
                  onClick={() => setDataSource("preloaded")}
                  className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${dataSource === "preloaded"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  Library
                </button>
                <button
                  onClick={() => setDataSource("upload")}
                  className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${dataSource === "upload"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Upload size={14} className="inline-block mr-2 relative" />
                  <span className="align-middle">Upload</span>
                </button>
              </div>

              {dataSource === "preloaded" ? (
                <div className="space-y-3">
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                    {availableDatasets.map((d) => (
                      <label 
                        key={d.key} 
                        className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          selectedKeys.includes(d.key) 
                            ? "bg-indigo-600/15 border-indigo-500/40 text-white" 
                            : "bg-white/[0.02] border-white/[0.05] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                        }`}
                      >
                        <div className="relative flex items-center justify-center">
                          <input
                            type="radio"
                            name="dataset-selection"
                            className="peer appearance-none w-4 h-4 rounded-full border-2 border-white/10 bg-black/20 checked:border-indigo-500 transition-all cursor-pointer"
                            checked={selectedKeys.includes(d.key)}
                            onChange={() => setSelectedKeys([d.key])}
                          />
                          <div className="absolute w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex-1 truncate">
                          <p className="text-[10px] font-black truncate uppercase tracking-widest">{d.label}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    className="btn-primary w-full text-sm py-3 flex items-center justify-center gap-2"
                    onClick={handleLoadSelected}
                    disabled={loadingDataset || selectedKeys.length === 0}
                  >
                    {loadingDataset ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Load Dataset
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    className="btn-secondary w-full text-sm py-3 flex items-center justify-center gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loadingDataset}
                  >
                    {loadingDataset ? (
                      <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    ) : (
                      <><Upload size={16} /> Choose CSV file</>
                    )}
                  </button>
                </div>
              )}

              {datasetError && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-rose-400 text-xs mt-3 flex items-center gap-1.5"
                >
                  <Info size={12} /> {datasetError}
                </motion.p>
              )}
            </motion.div>
            <button
              onClick={handleNewChat}
              className="w-full bg-white/[0.03] hover:bg-white/[0.08] text-white border border-white/10 rounded-xl py-3 px-4 font-semibold transition-all flex items-center justify-between group/chat"
            >
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-indigo-400 group-hover/chat:scale-110 transition-transform" />
                <span>New Analysis</span>
              </div>
              <Sparkles size={14} className="text-indigo-500/50 group-hover/chat:text-indigo-400 transition-colors" />
            </button>

            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input 
                type="text" 
                placeholder="Search chats..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>

            {chatSessions.length > 0 && (
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col"
              >
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4 mt-2 border-t border-white/[0.05] pt-6">
                  Chat History
                </p>
                <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide pr-1 mt-2">
                  {chatSessions
                    .filter(s => s.title?.toLowerCase().includes(searchQuery.toLowerCase()) || s.dataset_name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((session) => (
                    <div
                      key={session.id}
                      onClick={() => !renamingId && handleLoadSession(session)}
                      className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                        activeSessionId === session.id
                          ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                          : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1">
                        <MessageSquare size={14} className={activeSessionId === session.id ? "text-indigo-400" : "text-slate-500"} />
                        {renamingId === session.id ? (
                          <input
                            autoFocus
                            className="bg-slate-800 text-xs text-white px-1 py-0.5 rounded outline-none border border-indigo-500 w-full"
                            value={renamingTitle}
                            onChange={(e) => setRenamingTitle(e.target.value)}
                            onBlur={() => {
                              handleRenameSession(session, renamingTitle);
                              setRenamingId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameSession(session, renamingTitle);
                                setRenamingId(null);
                              } else if (e.key === 'Escape') {
                                setRenamingId(null);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="text-xs truncate font-medium">
                            {session.title || session.dataset_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(session.id);
                            setRenamingTitle(session.title || session.dataset_name);
                          }}
                          className="p-1 text-slate-500 hover:text-indigo-400"
                          title="Rename Session"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                          title="Delete Session"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

              {datasetPayload && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-6 glass-card p-4 text-xs"
                >
                  <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active Dataset
                  </div>
                  <p className="text-white font-medium truncate mb-1">{datasetPayload.filename}</p>
                  <p className="text-slate-400">{datasetPayload.shape[0].toLocaleString()} rows • {datasetPayload.shape[1]} cols</p>
                </motion.div>
              )}

            {user && (
            <div className="mt-auto pt-6 border-t border-white/[0.05] space-y-2">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10 shadow-inner">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20">
                  {user?.display_name?.charAt(0) || "U"}
                </div>
                <div className="flex-1 truncate">
                  <p className="text-xs font-bold text-white truncate">{user?.display_name}</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">{user?.role}</p>
                </div>
              </div>
            </div>
            )}
            {/* Discovery Section */}
            {datasetPayload && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 pt-6 border-t border-white/[0.05]"
              >
                <div className="flex items-center gap-2 text-indigo-400 font-black text-[9px] uppercase tracking-[0.2em] mb-4 px-2">
                  <Sparkles size={12} /> Intelligence Discovery
                </div>
                <div className="space-y-4 px-2 pb-20">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Key Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {datasetPayload.schema.column_names.slice(0, 8).map(col => (
                        <span key={col} className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] text-slate-400 hover:text-white transition-colors cursor-default">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {datasetPayload.schema.categorical_columns.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Categorical Context</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed italic">
                        Try asking about distributions across <span className="text-indigo-400">{datasetPayload.schema.categorical_columns[0]}</span> or <span className="text-indigo-400">{datasetPayload.schema.categorical_columns[1] || 'segments'}</span>.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </aside>

          <main className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {datasetPayload && (
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">{datasetPayload.filename}</h2>
                <span className="text-[#64748B] text-sm">
                  {datasetPayload.shape[0].toLocaleString()} rows, {datasetPayload.shape[1]} columns
                </span>
              </div>
            )}

            <div className="flex gap-2 mb-10 bg-black/40 p-1.5 rounded-2xl w-fit border border-white/5 backdrop-blur-xl shadow-2xl">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold tracking-tight transition-all duration-300 relative ${activeTab === t.id
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

            <div className="flex-1 relative">
              {/* Data Overview Tab */}
              <div className={activeTab === "overview" ? "block" : "hidden"}>
                {datasetPayload ? (
                  <div className="space-y-6">
                
                    <OverviewTab payload={datasetPayload} />
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
              <div className={activeTab === "analyst" ? "block" : "hidden"}>
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
                  />
                )}
              </div>

              {/* Forecasting Tab */}
              <div className={activeTab === "forecast" ? "block" : "hidden"}>
                {datasetPayload ? <ForecastingTab payload={datasetPayload} /> : <p className="text-slate-400 text-center py-20">Load a dataset to use forecasting.</p>}
              </div>

              {/* Reports Tab */}
              <div className={activeTab === "reports" ? "block" : "hidden"}>
                <ReportsTab 
                  payload={datasetPayload} 
                  user={user} 
                  messages={messages}
                  sendMessage={sendMessage}
                  isAnalyzing={isAnalyzing}
                  chatError={chatError}
                  activeSessionId={activeSessionId}
                />
              </div>

              {/* Live Board Tab */}
              <div className={activeTab === "board" ? "block" : "hidden"}>
                <LiveBoard 
                  isActive={activeTab === "board"} 
                />
              </div>

              {/* Alerts Tab */}
              {/* Alerts/Knowledge/Integrations tabs removed */}
            </div>
          </main>
        </div>

        
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
    </>
  );
}

import { DataQualityGauge } from "@/components/DataQualityGauge";
import PlotlyChart from "@/components/PlotlyChart";

function OverviewTab({ payload }: { payload: DatasetPayload }) {
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
        <div className="xl:col-span-9 space-y-8">
          <KPICards kpis={kpis} />
          
          {insights.length > 0 && (
            <section className="card p-8">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-6">
                <Sparkles size={14} /> Intelligence Briefing
              </div>
              <ul className="space-y-4">
                {displayedInsights.map((ins, i) => (
                  <motion.li 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="text-[15px] text-slate-300 flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors"
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

        <div className="xl:col-span-3 space-y-8">
          <DataQualityGauge 
            score={health_score ?? 98} 
            label="Dataset Health" 
          />
          
          <section className="card p-6">
             <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-4">
               <Info size={14} /> Quick Stats
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                 <p className="text-2xl font-bold text-white">{schema.rows.toLocaleString()}</p>
                 <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Rows</p>
               </div>
               <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                 <p className="text-2xl font-bold text-white">{schema.columns}</p>
                 <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Columns</p>
               </div>
             </div>
          </section>
        </div>
      </div>

      {/* Relationships & Heatmap */}
      {correlations && correlations.columns.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-7 card p-8">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-6">
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
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-6">
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
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-6">
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
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                    isNumeric ? "bg-emerald-500/10 text-emerald-400" :
                    isCat ? "bg-indigo-500/10 text-indigo-400" :
                    isTime ? "bg-amber-500/10 text-amber-400" :
                    "bg-white/5 text-slate-500"
                  }`}>
                    {isNumeric ? "Numeric" : isCat ? "Category" : isTime ? "Date/Time" : "Text"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate">
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
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-1">
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
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Columns</span>
                      <button 
                        onClick={() => setVisibleColumns(schema.column_names)}
                        className="text-[9px] font-bold text-indigo-400 hover:text-white"
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
