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
  MicOff
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { DatasetPayload, User, ChatMessage } from "@/lib/types";
import { pinInsight } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import PlotlyChart from "./PlotlyChart";
import ConfirmModal from "./ConfirmModal";

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
  const [pinnedIndices, setPinnedIndices] = useState<Set<number>>(new Set());
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAnalyzing]);

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
    try {
      setPinnedIndices(prev => new Set(prev).add(idx));
      await pinInsight({
        dataset_key: payload.dataset_key,
        filename: payload.filename,
        query: messages[idx-1]?.role === 'user' ? messages[idx-1].content : "Analysis",
        chart_spec: msg.chart,
        narration: msg.content
      });
    } catch (err) {
      console.error("Failed to pin insight:", err);
      setPinnedIndices(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
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

  return (
    <div className="flex flex-col h-[calc(100vh-250px)] min-h-[550px] relative">
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

      <div className="flex-1 overflow-y-auto space-y-6 px-2 pb-24 pt-10 scrollbar-hide">
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
                      {msg.chart && (
                        <button 
                          onClick={() => handlePin(msg, idx)}
                          className={`p-1.5 border rounded-lg shadow-xl transition-all ${
                            pinnedIndices.has(idx) 
                              ? "bg-indigo-600 border-indigo-500 text-white" 
                              : "bg-slate-800 border-white/10 text-slate-400 hover:text-white"
                          }`}
                          title={pinnedIndices.has(idx) ? "Pinned to Dashboard" : "Pin to Dashboard"}
                        >
                          <Pin size={12} className={pinnedIndices.has(idx) ? "fill-current" : ""} />
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
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {msg.chart && msg.query_type !== "irrelevant" && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
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
          <div className="flex justify-start items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/20">
              <Bot size={18} className="animate-pulse" />
            </div>
            <div className="chat-bubble-ai flex items-center gap-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
                  />
                ))}
              </div>
              <span className="text-slate-400 font-medium italic">Analyzing...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#030712] via-[#030712]/95 to-transparent">
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
              className="bg-transparent border-none focus:ring-0 text-[15px] text-white placeholder-slate-600 flex-1 py-3 outline-none"
              placeholder={isListening ? "Listening..." : (payload ? "Ask your data anything..." : "Upload a dataset to begin...")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAnalyzing || !payload}
            />
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
