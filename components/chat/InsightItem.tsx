import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  Bot, 
  User as UserIcon, 
  Copy, 
  Check, 
  Volume2, 
  Edit3, 
  Maximize2, 
  Pin, 
  PlusCircle, 
  Save, 
  X,
  Table as TableIcon
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/lib/types";
import PlotlyChart from "../PlotlyChart";

interface InsightItemProps {
  msg: ChatMessage;
  idx: number;
  typedContent?: string;
  isEditing: boolean;
  editingContent: string;
  setEditingContent: (content: string) => void;
  onEdit: (idx: number) => void;
  onSaveEdit: (idx: number) => void;
  onCancelEdit: () => void;
  onCopy: (text: string, idx: number) => void;
  isCopied: boolean;
  onSpeak: (text: string, idx: number) => void;
  isSpeaking: boolean;
  onFocus: (idx: number) => void;
  onPin: (msg: ChatMessage, idx: number) => void;
  isPinned: boolean;
  onToggleReport: (idx: number) => void;
  isInReport: boolean;
}

export const InsightItem: React.FC<InsightItemProps> = ({
  msg,
  idx,
  typedContent,
  isEditing,
  editingContent,
  setEditingContent,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onCopy,
  isCopied,
  onSpeak,
  isSpeaking,
  onFocus,
  onPin,
  isPinned,
  onToggleReport,
  isInReport,
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-start gap-3`}
    >
      {msg.role === "assistant" && (
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/20">
          <Bot size={18} />
        </div>
      )}
      
      <div className={`flex flex-col gap-2 group transition-all duration-300 ${msg.role === "assistant" ? "flex-1" : ""} ${isEditing ? "w-full max-w-full" : "max-w-[92%]"}`}>
        <div className={`${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"} relative group ${isEditing ? "w-full !max-w-full" : ""}`}>
          {msg.role === "assistant" && (
            <div className="absolute -top-3 -right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <button 
                onClick={() => onCopy(msg.content, idx)}
                className="p-1.5 bg-slate-800 border border-white/10 rounded-lg text-slate-400 hover:text-white shadow-xl"
                title="Copy to clipboard"
              >
                {isCopied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <button 
                onClick={() => onSpeak(msg.content, idx)}
                className={`p-1.5 border border-white/10 rounded-lg shadow-xl transition-all ${isSpeaking ? "bg-indigo-600 text-white animate-pulse" : "bg-slate-800 text-slate-400 hover:text-white"}`}
                title={isSpeaking ? "Stop Reading" : "Read Aloud"}
              >
                <Volume2 size={12} />
              </button>
              <button 
                onClick={() => onEdit(idx)}
                className="p-1.5 bg-slate-800 border border-white/10 rounded-lg text-slate-400 hover:text-white shadow-xl"
                title="Edit Narration"
              >
                <Edit3 size={12} />
              </button>
              <button 
                onClick={() => onFocus(idx)}
                className="p-1.5 bg-slate-800 border border-white/10 rounded-lg text-slate-400 hover:text-white shadow-xl transition-all hover:scale-110 active:scale-95"
                title="View Full Screen"
              >
                <Maximize2 size={12} />
              </button>
              {msg.chart && (
                <button 
                  onClick={() => onPin(msg, idx)}
                  className={`p-1.5 border rounded-lg shadow-xl transition-all ${
                    isPinned 
                      ? "bg-indigo-600 border-indigo-500 text-white" 
                      : "bg-slate-800 border-white/10 text-slate-400 hover:text-white"
                  }`}
                  title={isPinned ? "Pinned to Dashboard" : "Pin to Dashboard"}
                >
                  <Pin size={12} className={isPinned ? "fill-current" : ""} />
                </button>
              )}
              {msg.query_type !== 'irrelevant' && (
                <button 
                  onClick={() => onToggleReport(idx)}
                  className={`p-1.5 border rounded-lg shadow-xl transition-all ${
                    isInReport 
                      ? "bg-emerald-600 border-emerald-500 text-white" 
                      : "bg-slate-800 border-white/10 text-slate-400 hover:text-white"
                  }`}
                  title={isInReport ? "Remove from report" : "Add to report"}
                >
                  <PlusCircle size={12} />
                </button>
              )}
            </div>
          )}
          
          <div className="leading-relaxed prose prose-invert prose-sm md:prose-base max-w-none prose-p:text-slate-200">
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 min-h-[160px] resize-none custom-scrollbar"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSaveEdit(idx); } }}
                  autoFocus
                />
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <button 
                    onClick={() => onSaveEdit(idx)}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xl shadow-indigo-600/20"
                  >
                    <Save size={14} /> Update Narration
                  </button>
                  <button 
                    onClick={onCancelEdit}
                    className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-bold transition-all border border-transparent hover:border-rose-500/20"
                  >
                    <X size={14} /> Discard Changes
                  </button>
                </div>
              </div>
            ) : (
              <ReactMarkdown>{msg.role === "assistant" ? (typedContent || "") : msg.content}</ReactMarkdown>
            )}
          </div>

          {msg.chart && msg.query_type !== "irrelevant" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mt-4 -mx-2 bg-black/20 rounded-xl overflow-hidden border border-white/5 shadow-inner"
            >
              <PlotlyChart 
                spec={msg.chart} 
                height={340} 
              />
            </motion.div>
          )}

          {!msg.chart && msg.result && msg.result.length > 0 && msg.result.length <= 10 && (
            <div className="mt-4 p-3 bg-black/20 rounded-xl border border-white/5 overflow-x-auto">
              <div className="flex items-center gap-2 mb-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <TableIcon size={12} /> Data Result
              </div>
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    {Object.keys(msg.result[0]).map((col) => (
                      <th key={col} className="py-2 px-2 text-left text-slate-500 font-bold whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {msg.result.map((row, ri) => (
                    <tr key={ri} className="border-b border-white/[0.02] last:border-0">
                      {Object.values(row).map((val, ci) => (
                        <td key={ci} className="py-2 px-2 text-slate-300 whitespace-nowrap">
                          {String(val ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {msg.timestamp && (
          <span className="text-xs text-slate-600 font-medium px-1">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {msg.role === "user" && (
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 shrink-0 border border-white/10">
          <UserIcon size={18} />
        </div>
      )}
    </motion.div>
  );
};
