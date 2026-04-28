import { useState, useRef, useEffect } from "react";
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
  Zap
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { DatasetPayload, User, ChatMessage } from "@/lib/types";
import { pinInsight, unpinInsight, listPinnedInsights } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import PlotlyChart from "./PlotlyChart";
import ConfirmModal from "./ConfirmModal";
import { toast } from "sonner";
import { MessageSkeleton } from "./Skeleton";
import { Volume2, Edit3, Save, X } from "lucide-react";

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
}

export default function AIAnalyst({ 
  payload, 
  user, 
  messages,
  sendMessage,
  clearChat,
  isAnalyzing,
  chatError,
  onDatasetRecovered,
}: Props) {
  const [input, setInput] = useState("");
  const [showClearModal, setShowClearModal] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [pinnedMap, setPinnedMap] = useState<Record<number, string>>({});
  const [isListening, setIsListening] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAnalyzing]);

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

  const handleSend = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || isAnalyzing) return;
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

  const handleAddToReport = (idx: number) => {
    setAddedIndices(prev => new Set(prev).add(idx));
  };

  const handlePin = async (msg: ChatMessage, idx: number) => {
    if (!payload || !msg.chart) return;
    
    // Toggle Logic
    if (pinnedMap[idx]) {
      const pinId = pinnedMap[idx];
      try {
        // Optimistic update
        setPinnedMap(prev => {
          const next = { ...prev };
          delete next[idx];
          return next;
        });

        await unpinInsight(pinId);
        toast.success("Insight removed from dashboard");
        
        // Notify other UI (LiveBoard)
        window.dispatchEvent(new CustomEvent("pinned_insights:changed"));
      } catch (err) {
        console.error("Failed to unpin insight:", err);
        toast.error("Failed to unpin insight");
        // Rollback
        setPinnedMap(prev => ({ ...prev, [idx]: pinId }));
      }
      return;
    }

    try {
      const query = messages[idx-1]?.role === 'user' ? messages[idx-1].content : "Analysis";
      const result = await pinInsight({
        dataset_key: payload.dataset_key,
        filename: payload.filename,
        query: query,
        chart_spec: msg.chart,
        narration: msg.content
      });
      
      setPinnedMap(prev => ({ ...prev, [idx]: result.id }));
      toast.success("Insight pinned to dashboard!");

      // Notify other UI (LiveBoard) that pins changed so it can refresh live
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        try {
          window.dispatchEvent(new CustomEvent("pinned_insights:changed"));
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error("Failed to pin insight:", err);
    }
  };

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

  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    toast.info("Speaking analysis...", { icon: <Volume2 size={16} /> });
  };

  const handleSaveEdit = (idx: number) => {
    // Note: In a real app, you might want to persist this change to the backend too.
    // For now, we update the local message object.
    messages[idx].content = editingContent;
    setEditingIndex(null);
    toast.success("Narration updated locally");
  };
  
  return (
    <div className="flex flex-col h-[calc(100vh-220px)] relative overflow-hidden bg-[#030712]/20 rounded-2xl border border-white/5 shadow-2xl">
      <div className="absolute top-0 right-2 z-10">
        <button 
          onClick={() => setShowClearModal(true)}
          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          title="Clear Chat"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Clear Chat</span>
        </button>
      </div>

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
              
              <div className="flex flex-col gap-2 max-w-[85%] group">
                <div className={`${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"} relative group`}>
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
                        onClick={() => speak(msg.content)}
                        className="p-1.5 bg-slate-800 border border-white/10 rounded-lg text-slate-400 hover:text-white shadow-xl"
                        title="Read Aloud"
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
                      {msg.query_type !== 'irrelevant' && (
                        <button 
                          onClick={() => handleAddToReport(idx)}
                          className={`p-1.5 border rounded-lg shadow-xl transition-all ${
                            addedIndices.has(idx) 
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" 
                              : "bg-slate-800 border-white/10 text-slate-400 hover:text-white"
                          }`}
                          title="Add to report"
                        >
                          <PlusCircle size={12} />
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="leading-relaxed prose prose-invert prose-sm max-w-none">
                    {editingIndex === idx ? (
                      <div className="space-y-3">
                        <textarea
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 min-h-[100px]"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleSaveEdit(idx)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                          >
                            <Save size={12} /> Save
                          </button>
                          <button 
                            onClick={() => setEditingIndex(null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs font-bold"
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
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
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex justify-start items-start gap-3 w-full relative group"
          >
            <div className="absolute -inset-4 bg-indigo-500/5 blur-2xl rounded-full animate-pulse pointer-events-none" />
            <MessageSkeleton />
          </motion.div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#030712] via-[#030712]/95 to-transparent backdrop-blur-sm">
        {suggestions.length > 0 && messages.length <= 1 && payload && (
          <div className="flex flex-wrap gap-2.5 mb-6">
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
        
        <div className="relative group max-w-4xl mx-auto">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition-opacity duration-500" />
          <div className="relative flex items-center gap-3 p-2 bg-[#0B0F19]/80 backdrop-blur-2xl border border-white/10 rounded-2xl group-focus-within:border-indigo-500/50 transition-all shadow-2xl">
            <div className="pl-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
              <HelpCircle size={22} />
            </div>
            <input
              className="bg-transparent border-none focus:ring-0 text-[15px] text-white placeholder-slate-500 flex-1 py-4 outline-none"
              placeholder={isListening ? "Listening..." : (payload ? "Ask me to analyze your data..." : "Select a dataset first...")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAnalyzing || !payload}
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
                disabled={isAnalyzing || !payload}
                className={`p-2 rounded-xl transition-all ${
                  isListening 
                    ? "bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40" 
                    : "text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10"
                }`}
                title="Voice Input"
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button 
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                  input.trim() && !isAnalyzing && payload
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95" 
                    : "bg-white/5 text-slate-700 cursor-not-allowed"
                }`}
                onClick={() => handleSend()} 
                disabled={isAnalyzing || !input.trim() || !payload}
              >
                <span className="hidden sm:inline text-xs uppercase tracking-widest">Analyze</span>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={clearChat}
        title="Clear Analysis History"
        message="Are you sure you want to clear the analysis history?"
        confirmLabel="Clear"
        type="danger"
      />
    </div>
  );
}
