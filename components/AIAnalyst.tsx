import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Bot, 
  Check, 
  Copy, 
  Pin, 
  X,
  Maximize2,
  Volume2,
  AlertCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { DatasetPayload, User, ChatMessage } from "@/lib/types";
import { pinInsight, unpinInsight, listPinnedInsights } from "@/lib/api";
import { toast } from "sonner";
import { useStore } from "@/hooks/useStore";
import { ChatHistory } from "./chat/ChatHistory";
import { QueryInput } from "./chat/QueryInput";

interface Props {
  payload: DatasetPayload | null;
  user: User;
  onSwitchToForecast?: () => void;
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  isAnalyzing: boolean;
  chatError: string | null;
  onDatasetRecovered?: (payload: DatasetPayload) => void;
  selectedReportIndices: Set<number>;
  setSelectedReportIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
  onUpdateMessage?: (idx: number, content: string) => void;
}

const THINKING_STEPS = [
  "Scanning dataset architecture...",
  "Correlating data dimensions...",
  "Computing statistical significance...",
  "Narrating analytical synthesis..."
];

export default function AIAnalyst({ 
  payload: propPayload, 
  user: propUser, 
  messages: propMessages,
  sendMessage,
  isAnalyzing,
  selectedReportIndices,
  setSelectedReportIndices,
  onUpdateMessage,
}: Props) {
  const { datasetPayload, user: storeUser, addPinnedInsight, removePinnedInsight, setPendingDatasetToActivate } = useStore();
  
  const isReadOnly = !!(propPayload && datasetPayload && propPayload.dataset_key !== datasetPayload.dataset_key);
  const user = propUser || storeUser;
  const payload = useMemo(() => propPayload || datasetPayload, [propPayload, datasetPayload]);
  const messages = useMemo(() => propMessages || [], [propMessages]);
  
  const [input, setInput] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [pinnedMap, setPinnedMap] = useState<Record<number, string>>({});
  const [isListening, setIsListening] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // Autocomplete logic
  useEffect(() => {
    if (!input.trim() || !payload) {
      setTimeout(() => setShowAutocomplete(false), 0);
      return;
    }

    const words = input.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();

    if (lastWord.length < 1) {
      setTimeout(() => setShowAutocomplete(false), 0);
      return;
    }

    const keywords = [
      ...payload.schema.column_names,
      "total", "average", "mean", "sum", "count", "trend", "compare", "distribution", "top 5", "ranking"
    ];

    const matches = keywords.filter(k => k.toLowerCase().includes(lastWord) && k.toLowerCase() !== lastWord);
    setTimeout(() => {
      setAutocompleteItems(matches.slice(0, 5));
      setShowAutocomplete(matches.length > 0);
    }, 0);
  }, [input, payload]);

  const applyAutocomplete = (item: string) => {
    const words = input.split(/\s+/);
    words[words.length - 1] = item;
    setInput(words.join(" ") + " ");
    setTimeout(() => setShowAutocomplete(false), 0);
  };

  // Sync pins
  useEffect(() => {
    async function syncPins() {
      if (!payload) return;
      try {
        const pins = await listPinnedInsights();
        const newMap: Record<number, string> = {};
        messages.forEach((msg, idx) => {
          if (msg.role === 'assistant' && msg.chart) {
            const query = messages[idx-1]?.role === 'user' ? messages[idx-1].content : "Analysis";
            const existing = pins.find((p: any) => 
              p.dataset_key === payload.dataset_key && 
              p.query === query &&
              p.narration === msg.content
            );
            if (existing) newMap[idx] = existing.id;
          }
        });
        setPinnedMap(newMap);
      } catch (err) {
        console.error("Failed to sync pins:", err);
      }
    }
    syncPins();
  }, [messages, payload]);

  const [typedContent, setTypedContent] = useState<Record<number, string>>({});
  const typingRef = useRef<Set<number>>(new Set());

  // Reset index-based states when messages are cleared, session changes, or dataset switches
  useEffect(() => {
    setTypedContent({});
    typingRef.current.clear();
    setPinnedMap({});
    setCopiedIndex(null);
    setEditingIndex(null);
  }, [payload?.dataset_key, messages.length === 0]);

  // Typewriter effect - only for the latest message
  useEffect(() => {
    const lastIdx = messages.length - 1;
    if (lastIdx < 0) return;
    
    const msg = messages[lastIdx];
    if (msg.role === "assistant" && !typedContent[lastIdx] && !typingRef.current.has(lastIdx)) {
      typingRef.current.add(lastIdx);
      let i = 0;
      const fullText = msg.content;
      const interval = setInterval(() => {
        setTypedContent(prev => ({ ...prev, [lastIdx]: fullText.substring(0, i) }));
        i += 4;
        if (i > fullText.length) {
          setTypedContent(prev => ({ ...prev, [lastIdx]: fullText }));
          typingRef.current.delete(lastIdx);
          clearInterval(interval);
        }
      }, 12);
      return () => {
        typingRef.current.delete(lastIdx);
        clearInterval(interval);
      };
    }
  }, [messages.length]);

  // Loading steps
  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => setLoadingStep(prev => (prev + 1) % 4), 2500);
      return () => { clearInterval(interval); setLoadingStep(0); };
    }
  }, [isAnalyzing]);

  const handleSend = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || isAnalyzing) return;
    if (isReadOnly) {
      setPendingDatasetToActivate(propPayload);
      toast.warning("Dataset Not Active", { description: "Please activate this dataset to perform new analysis." });
      return;
    }
    setInput("");
    await sendMessage(q);
  };

  const handlePin = async (msg: ChatMessage, idx: number) => {
    if (!msg.chart || !payload) return;
    if (pinnedMap[idx]) {
      const pinId = pinnedMap[idx];
      try {
        removePinnedInsight(pinId);
        setPinnedMap(prev => { const next = { ...prev }; delete next[idx]; return next; });
        await unpinInsight(pinId);
        toast.success("Removed from dashboard");
      } catch (err) { toast.error("Failed to unpin"); }
      return;
    }

    try {
      const tempId = `temp-${Date.now()}`;
      const newPin = {
        id: tempId,
        dataset_key: payload.dataset_key,
        filename: payload.filename,
        query: messages[idx-1]?.content || "Insight",
        chart_spec: msg.chart,
        narration: msg.content,
        created_at: new Date().toISOString()
      };
      addPinnedInsight(newPin);
      setPinnedMap(prev => ({ ...prev, [idx]: tempId }));
      const savedPin = await pinInsight({
        dataset_key: payload.dataset_key,
        filename: payload.filename,
        query: messages[idx-1]?.content || "Insight",
        chart_spec: msg.chart,
        narration: msg.content
      });
      setPinnedMap(prev => ({ ...prev, [idx]: savedPin.id }));
      toast.success("Pinned to dashboard");
    } catch (err) {
      toast.error("Failed to pin insight");
      setPinnedMap(prev => { const next = { ...prev }; delete next[idx]; return next; });
    }
  };

  const toggleVoice = () => {
    if (isListening) { setIsListening(false); return; }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) { alert("Voice recognition is not supported in this browser."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => { setInput(event.results[0][0].transcript); setIsListening(false); };
    recognition.start();
  };

  const [currentlySpeakingIdx, setCurrentlySpeakingIdx] = useState<number | null>(null);
  const handleToggleSpeak = (text: string, idx: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (window.speechSynthesis.speaking && currentlySpeakingIdx === idx) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingIdx(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setCurrentlySpeakingIdx(null);
      window.speechSynthesis.speak(utterance);
      setCurrentlySpeakingIdx(idx);
    }
  };

  const suggestions = useMemo(() => {
    if (!payload?.schema) return [];
    const { schema } = payload;
    
    // Logic: Identify a meaningful metric (exclude Year, ID, etc.)
    const blacklist = ["year", "id", "date", "index", "sl no", "s.no"];
    const validMetrics = schema.numeric_columns.filter(c => 
      !blacklist.some(b => c.toLowerCase().includes(b))
    );
    
    const metric = validMetrics[0] || schema.numeric_columns[0];
    const category = schema.categorical_columns[0];
    const timeCol = schema.datetime_columns[0] || schema.numeric_columns.find(c => c.toLowerCase().includes("year"));

    return [
      metric && category ? `Total ${metric} by ${category}` : null,
      metric && category ? `Top 5 ${category} by ${metric}` : null,
      timeCol && metric ? `Trend of ${metric} over ${timeCol}` : null,
      category ? `Distribution of ${category}` : null,
      metric ? `Average ${metric} analysis` : null,
    ].filter(Boolean) as string[];
  }, [payload]);

  return (
    <div className="flex flex-col flex-1 h-full relative overflow-hidden bg-[#030712]/20 rounded-2xl border border-white/5 shadow-2xl">
      {isReadOnly && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0"><AlertCircle size={18} /></div>
            <div>
              <p className="text-xs font-bold text-amber-200">Read-Only History</p>
              <p className="text-xs text-amber-500/80 font-medium">Viewing history for &quot;{payload?.filename}&quot;.</p>
            </div>
          </div>
          <button onClick={() => setPendingDatasetToActivate(propPayload)} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded-lg transition-colors">Activate Now</button>
        </motion.div>
      )}

      <ChatHistory 
        messages={messages} payload={payload} isAnalyzing={isAnalyzing} thinkingSteps={THINKING_STEPS} loadingStep={loadingStep}
        typedContent={typedContent} editingIndex={editingIndex} editingContent={editingContent} setEditingContent={setEditingContent}
        onEdit={(idx) => { setEditingIndex(idx); setEditingContent(messages[idx].content); }}
        onSaveEdit={(idx) => { onUpdateMessage?.(idx, editingContent); setEditingIndex(null); toast.success("Updated locally"); }}
        onCancelEdit={() => setEditingIndex(null)}
        onCopy={(text, idx) => { navigator.clipboard.writeText(text); setCopiedIndex(idx); setTimeout(() => setCopiedIndex(null), 2000); }}
        copiedIndex={copiedIndex} onSpeak={handleToggleSpeak} currentlySpeakingIdx={currentlySpeakingIdx}
        onFocus={(idx) => setFocusedIndex(idx)} onPin={handlePin} pinnedMap={pinnedMap}
        onToggleReport={(idx) => setSelectedReportIndices(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; })}
        selectedReportIndices={selectedReportIndices}
      />

      <QueryInput 
        input={input} setInput={setInput} onSend={handleSend} isAnalyzing={isAnalyzing} isReadOnly={isReadOnly}
        isListening={isListening} toggleVoice={toggleVoice} suggestions={messages.length <= 1 ? suggestions : []}
        showAutocomplete={showAutocomplete} autocompleteItems={autocompleteItems} applyAutocomplete={applyAutocomplete}
        placeholder={isListening ? "Listening..." : (isReadOnly ? "Activate dataset to analyze..." : (payload ? "Ask me to analyze your data..." : "Select a dataset first..."))}
      />

      {/* Focus Mode Overlay */}
      <AnimatePresence>
        {focusedIndex !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-[#020617]/95 backdrop-blur-xl">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-[#0f172a] w-full max-w-6xl h-full max-h-[90vh] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden relative p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30"><Sparkles size={28} /></div>
                  <div>
                    <h2 className="text-2xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tight">Intelligence Focus</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{payload?.filename}</p>
                  </div>
                </div>
                <button onClick={() => setFocusedIndex(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/[0.02] border border-white/5 rounded-[2rem] p-8">
                <div className="prose prose-invert prose-indigo max-w-none prose-p:text-xl prose-p:leading-[1.7] prose-p:text-slate-200">
                  <ReactMarkdown>{messages[focusedIndex as number].content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
