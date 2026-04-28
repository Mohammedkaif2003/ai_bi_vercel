import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import {
  listDatasets,
  loadDataset,
  uploadCsv,
  fileToBase64,
  generateReport
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
    } catch (err: unknown) {
      setDatasetError(err instanceof Error ? err.message : "Failed to load dataset.");
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
    } catch (err: unknown) {
      setDatasetError(err instanceof Error ? err.message : "Failed to upload file.");
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
      <div className="min-h-screen flex flex-col bg-mesh">
        <header className="bg-[#030712]/60 backdrop-blur-2xl border-b border-white/[0.05] px-8 py-5 flex items-center gap-6 sticky top-0 z-50">
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
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-72 bg-[#0B0F19]/50 border-r border-white/[0.08] p-4 flex flex-col gap-4 overflow-y-auto shrink-0 hidden md:flex backdrop-blur-md">
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
                            ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-300" 
                            : "bg-white/[0.03] border-white/[0.05] text-slate-400 hover:bg-white/[0.06]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-white/10 bg-black/40 text-indigo-600 focus:ring-indigo-500/20"
                          checked={selectedKeys.includes(d.key)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedKeys([d.key]);
                            else setSelectedKeys([]);
                          }}
                        />
                        <div className="flex-1 truncate">
                          <p className="text-[11px] font-bold truncate uppercase tracking-wider">{d.label}</p>
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 px-4 font-semibold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-between"
            >
              <span>New Chat</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
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
                className="flex-1 flex flex-col min-h-0"
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
          </aside>

          <main className="flex-1 overflow-y-auto p-5">
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

function OverviewTab({ payload }: { payload: DatasetPayload }) {
  const [showAll, setShowAll] = useState(false);
  const { schema, kpis, insights, preview_rows: previewRows = [] } = payload;
  const displayedInsights = showAll ? insights : insights.slice(0, 4);

  return (
    <div className="space-y-5">
      <KPICards kpis={kpis} />

      {insights.length > 0 && (
        <section className="card">
          <h3 className="section-title">Auto Insights</h3>
          <ul className="space-y-1.5">
            {displayedInsights.map((ins, i) => (
              <li key={i} className="text-sm text-[#CBD5E1] flex gap-2">
                <span className="text-[#4F46E5] mt-0.5">•</span>
                <span>{ins}</span>
              </li>
            ))}
          </ul>
          {insights.length > 4 && (
            <button
              className="text-xs text-[#818CF8] mt-2 hover:underline"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show less" : `Show ${insights.length - 4} more...`}
            </button>
          )}
        </section>
      )}

      <section className="card">
        <h3 className="section-title">Dataset Schema</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Rows", value: schema.rows.toLocaleString() },
            { label: "Columns", value: schema.columns },
            { label: "Numeric", value: schema.numeric_columns.length },
            { label: "Categorical", value: schema.categorical_columns.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#0F172A] rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-[#64748B] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {schema.column_names.map((col) => (
            <span
              key={col}
              className="text-xs bg-[#1E293B] border border-[#334155] text-[#94A3B8] px-2 py-0.5 rounded"
            >
              {col}
            </span>
          ))}
        </div>
      </section>

      {previewRows.length > 0 && (
        <section className="card overflow-hidden">
          <h3 className="section-title">Data Preview (first 20 rows)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#334155]">
                  {schema.column_names.map((col) => (
                    <th key={col} className="text-left py-2 px-3 text-[#64748B] font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr key={ri} className="border-b border-[#1E293B] hover:bg-[#1E293B]/50 transition-colors">
                    {schema.column_names.map((col) => (
                      <td key={col} className="py-1.5 px-3 text-[#CBD5E1] whitespace-nowrap">
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
