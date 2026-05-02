import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Sparkles, 
  Bot, 
  User as UserIcon, 
  HelpCircle,
  Table as TableIcon,
  Trash2,
  Copy,
  PlusCircle,
  Check,
  Pin,
  PinOff,
  Mic,
  MicOff,
  Zap,
  Loader2,
  AlertCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { DatasetPayload, User, ChatMessage } from "@/lib/types";
import { pinInsight, unpinInsight, listPinnedInsights } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import PlotlyChart from "./PlotlyChart";
import ConfirmModal from "./ConfirmModal";
import { toast } from "sonner";
import { useStore } from "@/hooks/useStore";
import { MessageSkeleton } from "./Skeleton";
import { Volume2, Edit3, Save, X, Maximize2 } from "lucide-react";

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
}

export default function AIAnalyst({ 
  payload: propPayload, 
  user: propUser, 
  messages: propMessages,
  sendMessage: propSendMessage,
  clearChat: propClearChat,
  isAnalyzing: propIsAnalyzing,
  chatError: propChatError,
  onSwitchToForecast,
  onDatasetRecovered,
  selectedReportIndices,
  setSelectedReportIndices,
}: Props) {
  const { datasetPayload, user: storeUser, addPinnedInsight, removePinnedInsight, setPendingDatasetToActivate } = useStore();
  
  const isReadOnly = !!(propPayload && datasetPayload && propPayload.dataset_key !== datasetPayload.dataset_key);
  const user = propUser || storeUser;
  const messages = propMessages || [];
  const sendMessage = propSendMessage;
  const clearChat = propClearChat;
  const isAnalyzing = propIsAnalyzing;
  const chatError = propChatError;

  const payload = propPayload || datasetPayload;
  const [input, setInput] = useState("");
  const [showClearModal, setShowClearModal] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [pinnedMap, setPinnedMap] = useState<Record<number, string>>({});
  const [isListening, setIsListening] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMsgCount = useRef(0);

  useEffect(() => {
    // Only scroll if messages count increased
    if (messages.length > lastMsgCount.current) {
      // Small delay to let the DOM update (especially for charts)
      const timer = setTimeout(() => {
        const behavior = isAnalyzing ? "smooth" : "auto";
        bottomRef.current?.scrollIntoView({ behavior, block: "end" });
      }, 100);
      lastMsgCount.current = messages.length;
      return () => clearTimeout(timer);
    }
    lastMsgCount.current = messages.length;
  }, [messages.length, isAnalyzing]);

  // Autocomplete logic
  useEffect(() => {
    if (!input.trim() || !payload) {
      setShowAutocomplete(false);
      return;
    }

    const words = input.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();

    if (lastWord.length < 1) {
      setShowAutocomplete(false);
      return;
    }

    const keywords = [
      ...payload.schema.column_names,
      ...payload.schema.categorical_columns.flatMap(col => {
        // In a real app, we'd fetch unique values. For now, we suggest columns.
        return []; 
      }),
      "total", "average", "mean", "sum", "count", "trend", "compare", "distribution", "top 5", "ranking"
    ];

    const matches = keywords.filter(k => k.toLowerCase().includes(lastWord) && k.toLowerCase() !== lastWord);
    setAutocompleteItems(matches.slice(0, 5));
    setShowAutocomplete(matches.length > 0);
  }, [input, payload]);

  const applyAutocomplete = (item: string) => {
    const words = input.split(/\s+/);
    words[words.length - 1] = item;
    setInput(words.join(" ") + " ");
    setShowAutocomplete(false);
  };

  // Synchronize pinned status when messages change
  useEffect(() => {
    async function syncPins() {
      if (!payload) return;
      try {
        const pins = await listPinnedInsights();
        const newMap: Record<number, string> = {};
        
        messages.forEach((msg, idx) => {
          if (msg.role === 'assistant' && msg.chart) {
            const query = messages[idx-1]?.role === 'user' ? messages[idx-1].content : "Analysis";
            // Match by dataset, query and narration
            const existing = pins.find((p: any) => 
              p.dataset_key === payload.dataset_key && 
              p.query === query &&
              p.narration === msg.content
            );
            if (existing) {
              newMap[idx] = existing.id;
            }
          }
        });
        setPinnedMap(newMap);
      } catch (err) {
        console.error("Failed to sync pins:", err);
      }
    }
    syncPins();
  }, [messages, payload]);

  // Typewriter effect state
  const [typedContent, setTypedContent] = useState<Record<number, string>>({});

  useEffect(() => {
    messages.forEach((msg, idx) => {
      if (msg.role === "assistant" && !typedContent[idx]) {
        let i = 0;
        const fullText = msg.content;
        const interval = setInterval(() => {
          setTypedContent(prev => ({
            ...prev,
            [idx]: fullText.substring(0, i)
          }));
          i += 4; // Type 4 chars at a time for speed
          if (i > fullText.length) {
            setTypedContent(prev => ({ ...prev, [idx]: fullText }));
            clearInterval(interval);
          }
        }, 12);
        return () => clearInterval(interval);
      }
    });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || isAnalyzing) return;
    
    if (isReadOnly) {
      setPendingDatasetToActivate(propPayload);
      toast.warning("Dataset Not Active", {
        description: "Please activate this dataset to perform new analysis."
      });
      return;
    }

    setInput("");
    await sendMessage(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getSuggestions = () => {
    if (!payload?.schema) return [];
    const { schema } = payload;
    const metric = schema.numeric_columns[0];
    const category = schema.categorical_columns[0];
    return [
      metric && category ? `Total ${metric} by ${category}` : null,
      metric && category ? `Top 5 ${category} by ${metric}` : null,
      schema.datetime_columns[0] && metric ? `Trend of ${metric} over time` : null,
      metric ? `Average ${metric} distribution` : null,
    ].filter(Boolean) as string[];
  };

  const suggestions = getSuggestions();
  
  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };


  const handlePin = async (msg: ChatMessage, idx: number) => {
    if (!msg.chart || !payload) return;
    
    // Check if already pinned
    if (pinnedMap[idx]) {
      const pinId = pinnedMap[idx];
      try {
        removePinnedInsight(pinId);
        setPinnedMap(prev => {
          const next = { ...prev };
          delete next[idx];
          return next;
        });
        await unpinInsight(pinId);
        toast.success("Removed from dashboard");
      } catch (err) {
        toast.error("Failed to unpin");
      }
      return;
    }

    try {
      // Create a temporary ID for optimistic update
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

      // Optimistic Update
      addPinnedInsight(newPin);
      setPinnedMap(prev => ({ ...prev, [idx]: tempId }));
      
      const savedPin = await pinInsight({
        dataset_key: payload.dataset_key,
        filename: payload.filename,
        query: messages[idx-1]?.content || "Insight",
        chart_spec: msg.chart,
        narration: msg.content
      });
      
      // Replace temp ID with real ID
      setPinnedMap(prev => ({ ...prev, [idx]: savedPin.id }));
      toast.success("Pinned to dashboard");
    } catch (err) {
      toast.error("Failed to pin insight");
      // Rollback
      setPinnedMap(prev => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
    }
  }

  const toggleVoice = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.start();
  };

  const [currentlySpeakingIdx, setCurrentlySpeakingIdx] = useState<number | null>(null);

  const handleToggleSpeak = (text: string, idx: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (window.speechSynthesis.speaking && currentlySpeakingIdx === idx) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingIdx(null);
      toast.info("Speech stopped");
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1;
      utterance.onend = () => setCurrentlySpeakingIdx(null);
      utterance.onerror = () => setCurrentlySpeakingIdx(null);
      
      window.speechSynthesis.speak(utterance);
      setCurrentlySpeakingIdx(idx);
      toast.info("Speaking analysis...", { icon: <Volume2 size={16} /> });
    }
  };

  const handleToggleReport = (idx: number) => {
    if (!setSelectedReportIndices) return;
    setSelectedReportIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
        toast.info("Removed from report briefing");
      } else {
        next.add(idx);
        toast.success("Added to report briefing");
      }
      return next;
    });
  };

  const handleSaveEdit = (idx: number) => {
    // Note: In a real app, you might want to persist this change to the backend too.
    // For now, we update the local message object.
    messages[idx].content = editingContent;
    setEditingIndex(null);
    toast.success("Narration updated locally");
  };
  
  return (
    <div className="flex flex-col h-[calc(100vh-160px)] relative overflow-hidden bg-[#030712]/20 rounded-2xl border border-white/5 shadow-2xl">
      
      {isReadOnly && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <AlertCircle size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-200">Read-Only History</p>
              <p className="text-[10px] text-amber-500/80 font-medium">Viewing history for "{propPayload?.filename}". Switch to this dataset to analyze.</p>
            </div>
          </div>
          <button 
            onClick={() => setPendingDatasetToActivate(propPayload)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors"
          >
            Activate Now
          </button>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto space-y-6 px-6 pb-32 pt-10 custom-scrollbar">
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
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-start gap-3`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/20">
                  <Bot size={18} />
                </div>
              )}
              
              <div className={`flex flex-col gap-2 group transition-all duration-300 ${editingIndex === idx ? "w-full max-w-full" : "max-w-[92%]"}`}>
                <div className={`${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"} relative group ${editingIndex === idx ? "w-full !max-w-full" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="absolute -top-3 -right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button 
                        onClick={() => handleCopy(msg.content, idx)}
                        className="p-1.5 bg-slate-800 border border-white/10 rounded-lg text-slate-400 hover:text-white shadow-xl"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <button 
                        onClick={() => handleToggleSpeak(msg.content, idx)}
                        className={`p-1.5 border border-white/10 rounded-lg shadow-xl transition-all ${currentlySpeakingIdx === idx ? "bg-indigo-600 text-white animate-pulse" : "bg-slate-800 text-slate-400 hover:text-white"}`}
                        title={currentlySpeakingIdx === idx ? "Stop Reading" : "Read Aloud"}
                      >
                        <Volume2 size={12} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingIndex(idx);
                          setEditingContent(msg.content);
                        }}
                        className="p-1.5 bg-slate-800 border border-white/10 rounded-lg text-slate-400 hover:text-white shadow-xl"
                        title="Edit Narration"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button 
                        onClick={() => setFocusedIndex(idx)}
                        className="p-1.5 bg-slate-800 border border-white/10 rounded-lg text-slate-400 hover:text-white shadow-xl transition-all hover:scale-110 active:scale-95"
                        title="View Full Screen"
                      >
                        <Maximize2 size={12} />
                      </button>
                      {msg.chart && (
                        <button 
                          onClick={() => handlePin(msg, idx)}
                          className={`p-1.5 border rounded-lg shadow-xl transition-all ${
                            pinnedMap[idx] 
                              ? "bg-indigo-600 border-indigo-500 text-white" 
                              : "bg-slate-800 border-white/10 text-slate-400 hover:text-white"
                          }`}
                          title={pinnedMap[idx] ? "Pinned to Dashboard" : "Pin to Dashboard"}
                        >
                          <Pin size={12} className={pinnedMap[idx] ? "fill-current" : ""} />
                        </button>
                      )}
                      {msg.query_type !== 'irrelevant' && selectedReportIndices && (
                        <button 
                          onClick={() => handleToggleReport(idx)}
                          className={`p-1.5 border rounded-lg shadow-xl transition-all ${
                            selectedReportIndices.has(idx) 
                              ? "bg-emerald-600 border-emerald-500 text-white" 
                              : "bg-slate-800 border-white/10 text-slate-400 hover:text-white"
                          }`}
                          title={selectedReportIndices.has(idx) ? "Remove from report" : "Add to report"}
                        >
                          <PlusCircle size={12} />
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="leading-relaxed prose prose-invert prose-sm md:prose-base max-w-none prose-p:text-slate-200">
                    {editingIndex === idx ? (
                      <div className="space-y-3">
                        <textarea
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 min-h-[160px] resize-none custom-scrollbar"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          autoFocus
                        />
                        <div className="flex flex-wrap items-center gap-3 mt-4">
                          <button 
                            onClick={() => handleSaveEdit(idx)}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xl shadow-indigo-600/20"
                          >
                            <Save size={14} /> Update Narration
                          </button>
                          <button 
                            onClick={() => setEditingIndex(null)}
                            className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-bold transition-all border border-transparent hover:border-rose-500/20"
                          >
                            <X size={14} /> Discard Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <ReactMarkdown>{msg.role === "assistant" ? (typedContent[idx] || "") : msg.content}</ReactMarkdown>
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
                      <div className="flex items-center gap-2 mb-2 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
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
                  <span className="text-[10px] text-slate-600 font-medium px-1">
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
                      ? (messages[messages.length-1].content.length > 50 ? "Heavy Analysis in Progress..." : "Analyzing Data patterns...")
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

      <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-[#030712] via-[#030712]/95 to-transparent backdrop-blur-sm">
        {suggestions.length > 0 && messages.length <= 1 && payload && (
          <div className="flex flex-wrap gap-2.5 mb-4 max-w-full mx-auto px-2">
            {suggestions.map((s) => (
              <button
                key={s}
                className="group flex items-center gap-2.5 text-[11px] bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-500 rounded-xl px-5 py-2.5 transition-all shadow-xl active:scale-95"
                onClick={() => handleSend(s)}
              >
                <Sparkles size={14} className="group-hover:text-indigo-200 transition-colors" />
                <span className="font-bold uppercase tracking-wider">{s}</span>
              </button>
            ))}
          </div>
        )}
        
        <div className="relative group max-w-full mx-auto">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition-opacity duration-500" />
          <div className="relative flex items-center gap-3 p-1.5 bg-[#0B0F19]/80 backdrop-blur-2xl border border-white/10 rounded-2xl group-focus-within:border-indigo-500/50 transition-all shadow-2xl">
            <div className="pl-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
              <HelpCircle size={22} />
            </div>
            <input
              className="bg-transparent border-none focus:ring-0 text-[15px] text-white placeholder-slate-500 flex-1 py-3 outline-none"
              placeholder={isListening ? "Listening..." : (isReadOnly ? "Activate dataset to analyze..." : (payload ? "Ask me to analyze your data..." : "Select a dataset first..."))}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAnalyzing || !payload || isReadOnly}
            />

            {/* Autocomplete Dropdown */}
            <AnimatePresence>
              {showAutocomplete && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full mb-3 left-0 w-64 bg-[#0B0F19] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-2 border-b border-white/5 bg-white/5">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2">Suggestions</span>
                  </div>
                  {autocompleteItems.map((item) => (
                    <button
                      key={item}
                      onClick={() => applyAutocomplete(item)}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{item}</span>
                      <Zap size={10} className="text-slate-600 group-hover:text-indigo-200" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex items-center gap-2 pr-2">
              <button
                onClick={toggleVoice}
                disabled={isAnalyzing || !payload || isReadOnly}
                className={`p-2 rounded-xl transition-all ${
                  isListening 
                    ? "bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40" 
                    : "text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10"
                } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
                title={isReadOnly ? "Activate dataset to use voice" : "Voice Input"}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button 
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                  input.trim() && !isAnalyzing && payload && !isReadOnly
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95" 
                    : "bg-white/5 text-slate-700 cursor-not-allowed"
                }`}
                onClick={() => handleSend()} 
                disabled={isAnalyzing || !input.trim() || !payload || isReadOnly}
              >
                <span className="hidden sm:inline text-xs uppercase tracking-widest">Analyze</span>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Focus Mode */}
      <AnimatePresence>
        {focusedIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-[#020617]/95 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#0f172a] w-full max-w-6xl h-full max-h-[90vh] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden relative"
            >
              <div className="absolute top-6 right-6 z-50">
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                      <Sparkles size={28} />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tight">Intelligence Focus</h2>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{payload?.filename || "Analysis"}</div>
                        <span className="text-slate-700">•</span>
                        <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{payload?.shape ? `${payload.shape[0].toLocaleString()} Data Points` : "Deep Dive"}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleCopy(messages[focusedIndex as number].content, focusedIndex as number)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 text-xs font-bold transition-all active:scale-95"
                    >
                      {copiedIndex === focusedIndex ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      {copiedIndex === focusedIndex ? "Copied" : "Copy Narrative"}
                    </button>
                    <button 
                      onClick={() => setFocusedIndex(null)}
                      className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95 shadow-lg group"
                    >
                      <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-10 gap-12 flex-1 min-h-0 pt-6">
                  <div className="lg:col-span-4 flex flex-col gap-8 overflow-y-auto pr-8 custom-scrollbar relative">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 blur-[100px] pointer-events-none rounded-full" />
                    
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 space-y-8 shadow-inner backdrop-blur-md relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
                      
                      <div className="flex items-center gap-3 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full w-fit shrink-0">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Synthesis Engine</span>
                      </div>

                      <div className="prose prose-invert prose-indigo max-w-none prose-p:text-xl prose-p:leading-[1.7] prose-p:text-slate-200 prose-strong:text-indigo-400 prose-headings:text-white prose-li:text-slate-300">
                        <ReactMarkdown>
                          {messages[focusedIndex as number].content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    <div className="mt-auto py-6 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">System Identity</span>
                        <span className="text-xs font-bold text-slate-400">Nexlytics Intelligence Engine</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Generated At</span>
                        <span className="text-xs font-bold text-slate-400">{new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-6 flex flex-col min-h-0 pl-4 border-l border-white/5">
                    {messages[focusedIndex as number].chart ? (
                      <div className="flex-1 bg-black/20 rounded-[3rem] border border-white/5 p-10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden flex items-center justify-center min-h-[550px]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_100%)] pointer-events-none" />
                        <PlotlyChart 
                          spec={messages[focusedIndex as number].chart!} 
                          height={620}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 rounded-[2.5rem] border border-white/5 border-dashed flex items-center justify-center bg-white/[0.01]">
                        <div className="text-center">
                          <Zap className="mx-auto mb-4 text-slate-700" size={32} />
                          <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Analytical Visualization Not Available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
