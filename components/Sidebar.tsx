import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
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
  Sparkles, 
  History as HistoryIcon,
  ShieldCheck,
  User,
  Settings
} from "lucide-react";
import LogoMark from "./LogoMark";
import { useStore } from "@/hooks/useStore";
import type { ChatSession } from "@/lib/types";

interface SidebarProps {
  onLoadSelected: (keys?: string[]) => Promise<void>;
  onProcessFile: (file: File) => Promise<void>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onNewChat: () => void;
  onLoadSession: (session: ChatSession) => Promise<void>;
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
  onRenameSession: (session: ChatSession, newTitle: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export default function Sidebar({
  onLoadSelected,
  onProcessFile,
  onFileUpload,
  onNewChat,
  onLoadSession,
  onDeleteSession,
  onRenameSession,
  onSignOut,
}: SidebarProps) {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    availableDatasets,
    dataSource,
    setDataSource,
    selectedKeys,
    setSelectedKeys,
    loadingDataset,
    datasetError,
    datasetPayload,
    chatSessions,
    activeSessionId,
    user
  } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`flex flex-col h-full glass-sidebar transition-all duration-300 ease-out will-change-transform ${sidebarCollapsed ? "w-20 items-center py-4" : "w-64"}`}>
      {/* Fixed Top Section */}
      <div className={`shrink-0 w-full ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
        {/* Logo and Toggle Header */}
        <div className={`flex items-center mb-6 px-5 relative ${sidebarCollapsed ? "justify-center px-0" : "justify-between"}`}>
          <div className="flex items-center">
            <div className="relative group/logo">
              <div className={`absolute inset-0 bg-indigo-500 blur-xl opacity-0 group-hover/logo:opacity-30 transition-opacity duration-500 rounded-full`} />
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 shrink-0 transition-all duration-500 relative z-10 ${sidebarCollapsed ? "scale-90" : ""}`}>
                <LogoMark className="w-4 h-4" />
              </div>
              
              {sidebarCollapsed && (
                <button 
                  onClick={() => setSidebarCollapsed(false)}
                  className="absolute inset-0 z-20 flex items-center justify-center text-white opacity-0 group-hover/logo:opacity-100 transition-all duration-300"
                  title="Expand Sidebar"
                >
                  <ChevronRight size={16} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                </button>
              )}
            </div>

            {!sidebarCollapsed && (
              <span className="text-lg font-black text-white tracking-tighter uppercase italic ml-2.5">
                Nexlytics
              </span>
            )}
          </div>

          {!sidebarCollapsed && (
            <button 
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-300"
              title="Collapse Sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        {!sidebarCollapsed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 px-3.5"
          >
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 px-1.5 opacity-50">
                Data Management
              </p>
              
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mb-3">
                <button 
                  onClick={() => setDataSource("preloaded")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                    dataSource === "preloaded" 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                      : "text-slate-500 hover:text-slate-300"
                    }`}
                >
                  <Library size={10} className="inline-block mr-1.5" />
                  <span>Library</span>
                </button>
                <button 
                  onClick={() => setDataSource("upload")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                    dataSource === "upload" 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                      : "text-slate-500 hover:text-slate-300"
                    }`}
                >
                  <Upload size={10} className="inline-block mr-1.5" />
                  <span>Upload</span>
                </button>
              </div>

              {dataSource === "preloaded" ? (
                <div className="relative group/select">
                  <select
                    className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-2.5 pl-3.5 pr-10 text-[9px] font-black uppercase tracking-[0.1em] text-slate-300 appearance-none focus:outline-none focus:border-indigo-500/40 transition-all cursor-pointer shadow-lg"
                    value={selectedKeys[0] || ""}
                    onChange={(e) => {
                      const key = e.target.value;
                      if (key) {
                        setSelectedKeys([key]);
                        onLoadSelected([key]);
                      }
                    }}
                  >
                    <option value="" disabled className="bg-[#0B0F19]">Select Source...</option>
                    {availableDatasets.map((d) => (
                      <option key={d.key} value={d.key} className="bg-[#0B0F19] py-2 text-[9px]">
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 group-hover/select:text-indigo-400 transition-colors">
                    <ChevronDown size={12} />
                  </div>
                </div>
              ) : (
                <div 
                  className="space-y-2"
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) await onProcessFile(file);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={onFileUpload}
                  />
                  <button
                    className={`w-full bg-white/[0.01] border rounded-xl py-3 px-3 flex items-center justify-center gap-2.5 transition-all duration-300 relative overflow-hidden group/upload ${
                      isDragging 
                        ? "bg-indigo-600/10 border-indigo-500 border-dashed shadow-2xl scale-[0.98]" 
                        : "border-white/5 border-dashed hover:border-indigo-500/20 hover:bg-white/[0.03]"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loadingDataset}
                  >
                    {loadingDataset ? (
                      <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload size={12} className={`text-indigo-400 group-hover/upload:scale-110 transition-transform ${isDragging ? "animate-bounce" : ""}`} />
                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 group-hover/upload:text-white transition-colors">
                          {isDragging ? "Drop to Load" : "Choose CSV File"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {datasetError && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[9px] text-rose-500 font-bold mt-2 flex items-center gap-2 px-1.5"
                >
                  <Info size={10} /> {datasetError}
                </motion.p>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`glass-card-premium p-4 transition-all duration-500 ${!datasetPayload ? "opacity-30" : "border-emerald-500/10"}`}
            >
              {datasetPayload ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-emerald-500 text-[9px] font-black uppercase tracking-widest">
                      <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] ${(datasetPayload.health_score ?? 98) >= 80 ? "animate-health-green" : "animate-health-amber"}`} />
                      Live Data
                    </div>
                    <div className="text-[8px] font-black text-indigo-400 bg-indigo-400/5 px-1.5 py-0.5 rounded border border-indigo-500/10">
                      {datasetPayload.health_score ?? 98}%
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-white truncate mb-1">{datasetPayload.filename}</p>
                  <p className="text-[9px] text-slate-600 font-bold uppercase">{datasetPayload.shape[0].toLocaleString()} Rows • {datasetPayload.shape[1]} Cols</p>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-1 gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-700">
                    <Database size={16} />
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Awaiting Data</p>
                    <p className="text-[8px] text-slate-700 font-bold uppercase">Ready for Analysis</p>
                  </div>
                </div>
              )}
            </motion.div>

            <button
              onClick={onNewChat}
              className="w-full relative group/newchat overflow-hidden rounded-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-90 group-hover/newchat:opacity-100 transition-opacity" />
              <div className="relative py-3 px-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Plus size={14} className="text-white group-hover/newchat:rotate-90 transition-transform duration-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.15em]">New Analysis</span>
                </div>
                <Sparkles size={12} className="text-white/40 group-hover/newchat:text-white transition-colors" />
              </div>
            </button>

            <div className="relative group/search">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-indigo-400 transition-colors" size={14} />
              <input 
                type="text" 
                placeholder="Search history..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-inner"
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Scrollable Chat History */}
      {!sidebarCollapsed && (
        <div className="flex-1 overflow-y-auto mt-5 space-y-1 scrollbar-hide pr-1 w-full px-3.5 mask-fade-y">
          <div className="flex items-center gap-2 mb-4 mt-1 px-1.5 opacity-50">
            <HistoryIcon size={10} className="text-indigo-400" />
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Chat History
            </p>
          </div>
          {chatSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center opacity-30 group/empty">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/5 group-hover/empty:border-indigo-500/20 transition-all duration-500">
                <MessageSquare size={24} className="text-slate-600 group-hover/empty:text-indigo-500 group-hover/empty:scale-110 transition-all" />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                No conversations yet
              </p>
              <p className="text-[9px] text-slate-600 font-bold mt-1 uppercase">Your AI sessions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-1 pb-6">
              {chatSessions
                .filter(s => s.title?.toLowerCase().includes(searchQuery.toLowerCase()) || s.dataset_name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((session) => (
              <div
                key={session.id}
                onClick={() => !renamingId && onLoadSession(session)}
                className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all duration-300 relative overflow-hidden ${
                  activeSessionId === session.id
                    ? "bg-indigo-600/10 text-white border border-indigo-500/20"
                    : "text-slate-600 hover:bg-white/[0.02] hover:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate flex-1 relative z-10">
                  <div className={`p-1 rounded ${activeSessionId === session.id ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-slate-700"} group-hover:text-indigo-400 transition-colors`}>
                    <MessageSquare size={10} />
                  </div>
                  {renamingId === session.id ? (
                    <input
                      autoFocus
                      className="bg-black/60 border border-indigo-500/50 rounded px-1.5 py-0.5 text-[10px] text-white outline-none w-full"
                      value={renamingTitle}
                      onChange={(e) => setRenamingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRenameSession(session, renamingTitle);
                          setRenamingId(null);
                        } else if (e.key === 'Escape') {
                          setRenamingId(null);
                        }
                      }}
                      onBlur={() => onRenameSession(session, renamingTitle).then(() => setRenamingId(null))}
                    />
                  ) : (
                    <span className="text-[10px] truncate font-bold uppercase tracking-tight">{session.title || session.dataset_name}</span>
                  )}
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 relative z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setRenamingId(session.id); setRenamingTitle(session.title || ""); }}
                    className="p-1 hover:text-indigo-400 transition-colors rounded hover:bg-white/5"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button 
                    onClick={(e) => onDeleteSession(session.id, e)}
                    className="p-1 hover:text-rose-500 transition-colors rounded hover:bg-white/5"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fixed User Section (Ultra Compact) */}
      {user && (
      <div className={`shrink-0 mt-auto pt-4 border-t border-white/[0.03] w-full px-3.5 mb-4 transition-all duration-500 ${sidebarCollapsed ? "px-0 flex flex-col items-center" : ""}`}>
        <div className={`flex items-center gap-2.5 transition-all duration-500 group/profile relative cursor-default ${sidebarCollapsed ? "justify-center p-0" : "p-2.5 bg-white/[0.02] rounded-xl border border-white/5 shadow-xl"}`}>
          <div className="relative group/avatar">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-indigo-500/20 shrink-0 border border-white/5 transition-all duration-500 relative z-10 ${sidebarCollapsed ? "scale-90" : ""}`}>
              {user?.display_name?.charAt(0) || "U"}
            </div>

            {sidebarCollapsed && (
              <button 
                onClick={onSignOut}
                className="absolute inset-0 z-20 flex items-center justify-center text-rose-500 opacity-0 group-hover/avatar:opacity-100 transition-all duration-300"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>

          {!sidebarCollapsed && (
            <>
              <div className="flex-1 truncate">
                <p className="text-[10px] font-black text-white truncate uppercase tracking-tight leading-tight">{user?.display_name?.split('@')[0]}</p>
                <div className="flex items-center gap-1">
                   <div className="w-1 h-1 rounded-full bg-emerald-500" />
                   <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">{user?.role || "PRO ANALYST"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                 <button 
                  onClick={onSignOut}
                  className="p-1 text-slate-600 hover:text-rose-500 transition-all"
                  title="Sign Out"
                >
                  <LogOut size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
