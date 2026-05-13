import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Loader2, Sparkles } from "lucide-react";
import type { ChatMessage, DatasetPayload } from "@/lib/types";
import { InsightItem } from "./InsightItem";
import { MessageSkeleton } from "../Skeleton";

interface ChatHistoryProps {
  messages: ChatMessage[];
  payload: DatasetPayload | null;
  isAnalyzing: boolean;
  thinkingSteps: string[];
  loadingStep: number;
  typedContent: Record<number, string>;
  editingIndex: number | null;
  editingContent: string;
  setEditingContent: (val: string) => void;
  onEdit: (idx: number) => void;
  onSaveEdit: (idx: number) => void;
  onCancelEdit: () => void;
  onCopy: (text: string, idx: number) => void;
  copiedIndex: number | null;
  onSpeak: (text: string, idx: number) => void;
  currentlySpeakingIdx: number | null;
  onFocus: (idx: number) => void;
  onPin: (msg: ChatMessage, idx: number) => void;
  pinnedMap: Record<number, string>;
  onToggleReport: (idx: number) => void;
  selectedReportIndices: Set<number>;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  messages,
  payload,
  isAnalyzing,
  thinkingSteps,
  loadingStep,
  typedContent,
  editingIndex,
  editingContent,
  setEditingContent,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onCopy,
  copiedIndex,
  onSpeak,
  currentlySpeakingIdx,
  onFocus,
  onPin,
  pinnedMap,
  onToggleReport,
  selectedReportIndices,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMsgCount = useRef(0);

  useEffect(() => {
    if (messages.length > lastMsgCount.current) {
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ 
          behavior: isAnalyzing ? "smooth" : "auto", 
          block: "end" 
        });
      }, 100);
      lastMsgCount.current = messages.length;
      return () => clearTimeout(timer);
    }
    lastMsgCount.current = messages.length;
  }, [messages.length, isAnalyzing]);

  return (
    <div className="flex-1 overflow-y-auto space-y-6 px-6 pb-32 pt-10 custom-scrollbar mask-fade-y">
      <AnimatePresence initial={false}>
        {messages.length === 0 && payload && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="chat-bubble-ai max-w-[90%]"
           >
             <Bot size={18} className="text-indigo-400 mb-2" />
             <p className="leading-relaxed">
               Hello! I&apos;m your AI Analyst. I&apos;ve indexed **{payload.filename}** ({payload.shape[0].toLocaleString()} rows). 
               Ask me about trends, distributions, or specific comparisons.
             </p>
           </motion.div>
        )}

        {messages.map((msg, idx) => (
          <InsightItem 
            key={idx}
            msg={msg}
            idx={idx}
            typedContent={typedContent[idx]}
            isEditing={editingIndex === idx}
            editingContent={editingContent}
            setEditingContent={setEditingContent}
            onEdit={onEdit}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onCopy={onCopy}
            isCopied={copiedIndex === idx}
            onSpeak={onSpeak}
            isSpeaking={currentlySpeakingIdx === idx}
            onFocus={onFocus}
            onPin={onPin}
            isPinned={!!pinnedMap[idx]}
            onToggleReport={onToggleReport}
            isInReport={selectedReportIndices.has(idx)}
          />
        ))}
      </AnimatePresence>

      {isAnalyzing && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start items-start gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/20">
            <Loader2 size={18} className="animate-spin" />
          </div>
          <div className="flex flex-col gap-2 w-full max-w-[85%]">
            <div className="chat-bubble-ai w-full">
              <div className="flex items-center gap-3 mb-3 text-indigo-400">
                <Sparkles size={14} className="animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  {messages.length > 0 && messages[messages.length-1].role === 'user' 
                    ? thinkingSteps[loadingStep]
                    : "Synthesizing Insights..."}
                </span>
              </div>
              <MessageSkeleton />
            </div>
          </div>
        </motion.div>
      )}

      <div ref={bottomRef} className="h-4" />
    </div>
  );
};
