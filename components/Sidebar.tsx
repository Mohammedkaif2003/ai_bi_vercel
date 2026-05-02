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
    <div className={`flex flex-col h-full transition-all duration-300 ${sidebarCollapsed ? "items-center py-6" : ""}`}>
      {/* Fixed Top Section */}
      <div className={`shrink-0 w-full ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
        {/* Logo and Toggle Header */}
        <div className={`flex items-center mb-8 px-2 relative ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center">
            <div className="relative group/logo">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0 transition-all duration-300 ${sidebarCollapsed ? "group-hover/logo:opacity-20 group-hover/logo:scale-90" : ""}`}>
                <LogoMark className="w-6 h-6" />
              </div>
              
              {sidebarCollapsed && (
                <button 
                  onClick={() => setSidebarCollapsed(false)}
                  className="absolute inset-0 flex items-center justify-center text-white opacity-0 group-hover/logo:opacity-100 transition-all duration-300"
                  title="Expand Sidebar"
                >
                  <ChevronRight size={20} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                </button>
              )}
            </div>

            {!sidebarCollapsed && (
              <span className="text-xl font-black text-white tracking-tighter uppercase italic ml-3">
                Nexlytics
              </span>
            )}
          </div>

          {!sidebarCollapsed && (
            <button 
              onClick={() => setSidebarCollapsed(true)}
              className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              title="Collapse Sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {!sidebarCollapsed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 px-2"
          >
            <div>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4">
                Data Management
              </p>
              
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mb-4">
                <button 
                  onClick={() => setDataSource("preloaded")}
                  className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    dataSource === "preloaded" 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Library size={14} className="inline-block mr-2 relative" />
                  <span className="align-middle">Library</span>
                </button>
                <button 
                  onClick={() => setDataSource("upload")}
                  className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    dataSource === "upload" 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Upload size={14} className="inline-block mr-2 relative" />
                  <span className="align-middle">Upload</span>
                </button>
              </div>

              {dataSource === "preloaded" ? (
                <div className="relative group/select">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400/50 group-hover/select:text-indigo-400 transition-colors">
                    <Library size={14} />
                  </div>
                  <select
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-11 pr-10 text-xs font-bold uppercase tracking-widest text-slate-300 appearance-none focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer"
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
                      <option key={d.key} value={d.key} className="bg-[#0B0F19] py-2 text-[10px]">
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover/select:text-indigo-400 transition-colors">
                    <ChevronDown size={14} />
                  </div>
                </div>
              ) : (
                <div 
                  className="space-y-3"
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
                    className={`w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 flex items-center gap-3 transition-all relative ${
                      isDragging 
                        ? "bg-indigo-600/10 border-indigo-500 border-dashed shadow-lg shadow-indigo-500/10 scale-[0.98]" 
                        : "hover:bg-white/[0.06] hover:border-white/20 border-dashed"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loadingDataset}
                  >
                    {loadingDataset ? (
                      <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin ml-1" />
                    ) : (
                      <>
                        <Upload size={14} className={`text-indigo-400/50 ${isDragging ? "animate-bounce" : ""}`} />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-300 truncate">
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
                  className="text-rose-400 text-[10px] font-bold mt-3 flex items-center gap-1.5"
                >
                  <Info size={12} /> {datasetError}
                </motion.p>
              )}
            </div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`glass-card p-4 text-xs transition-all duration-500 ${!datasetPayload ? "border-dashed border-white/5 opacity-60" : "border-emerald-500/20"}`}
            >
              {datasetPayload ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Active Dataset
                    </div>
                    <div className="flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                      <span className="text-[10px] font-black text-indigo-400">{datasetPayload.health_score ?? 98}%</span>
                      <span className="text-[9px] text-indigo-500/60 font-bold uppercase">Health</span>
                    </div>
                  </div>
                  <p className="text-white font-medium truncate mb-1">{datasetPayload.filename}</p>
                  <p className="text-slate-400">{datasetPayload.shape[0].toLocaleString()} rows • {datasetPayload.shape[1]} cols</p>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-1">
                  <div className="flex items-center gap-2 text-slate-400 font-bold mb-1.5 uppercase tracking-tighter">
                    <Database size={14} className="text-slate-500" />
                    Awaiting Intelligence
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-[0.1em] text-center">
                    Select or drop a source to begin
                  </p>
                </div>
              )}
            </motion.div>

            <button
              onClick={onNewChat}
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
          </motion.div>
        )}
      </div>

      {/* Scrollable Chat History */}
      {!sidebarCollapsed && (
        <div className="flex-1 overflow-y-auto mt-6 space-y-1 scrollbar-hide pr-1 w-full px-2">
          <div className="flex items-center gap-2 mb-4 mt-2 px-1 opacity-80">
            <HistoryIcon size={12} className="text-indigo-400" />
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">
              Chat History
            </p>
          </div>
          {chatSessions
            .filter(s => s.title?.toLowerCase().includes(searchQuery.toLowerCase()) || s.dataset_name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((session) => (
            <div
              key={session.id}
              onClick={() => !renamingId && onLoadSession(session)}
              className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                activeSessionId === session.id
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/5"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2 truncate flex-1">
                <MessageSquare size={14} className={activeSessionId === session.id ? "text-indigo-400" : "text-slate-600"} />
                {renamingId === session.id ? (
                  <input
                    autoFocus
                    className="bg-black/40 border border-indigo-500/50 rounded px-1.5 py-0.5 text-xs text-white outline-none w-full"
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
                  <span className="text-xs truncate font-medium">{session.title || session.dataset_name}</span>
                )}
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setRenamingId(session.id); setRenamingTitle(session.title || ""); }}
                  className="p-1 hover:text-indigo-400 transition-colors"
                >
                  <Edit2 size={12} />
                </button>
                <button 
                  onClick={(e) => onDeleteSession(session.id, e)}
                  className="p-1 hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fixed User Section */}
      {user && (
      <div className="shrink-0 mt-auto pt-6 border-t border-white/[0.05] w-full px-2">
        <div className={`flex items-center gap-3 transition-all duration-300 ${sidebarCollapsed ? "justify-center p-0" : "p-3 bg-white/[0.03] rounded-2xl border border-white/10 shadow-inner group/user"}`}>
          <div className="relative group/avatar">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20 shrink-0 border border-white/10 transition-all duration-300 ${sidebarCollapsed ? "group-hover/avatar:opacity-20 group-hover/avatar:scale-90" : ""}`}>
              {user?.display_name?.charAt(0) || "U"}
            </div>

            {sidebarCollapsed && (
              <button 
                onClick={onSignOut}
                className="absolute inset-0 flex items-center justify-center text-rose-400 opacity-0 group-hover/avatar:opacity-100 transition-all duration-300"
                title="Sign Out"
              >
                <LogOut size={20} className="drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
              </button>
            )}
          </div>

          {!sidebarCollapsed && (
            <>
              <div className="flex-1 truncate">
                <p className="text-xs font-bold text-white truncate">{user?.display_name}</p>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">{user?.role}</p>
              </div>
              <button 
                onClick={onSignOut}
                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
