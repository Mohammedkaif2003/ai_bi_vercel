import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  HelpCircle, 
  Zap, 
  Mic, 
  MicOff, 
  Send 
} from "lucide-react";

interface QueryInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: (text?: string) => void;
  isAnalyzing: boolean;
  isReadOnly: boolean;
  isListening: boolean;
  toggleVoice: () => void;
  suggestions: string[];
  showAutocomplete: boolean;
  autocompleteItems: string[];
  applyAutocomplete: (item: string) => void;
  placeholder: string;
}

export const QueryInput: React.FC<QueryInputProps> = ({
  input,
  setInput,
  onSend,
  isAnalyzing,
  isReadOnly,
  isListening,
  toggleVoice,
  suggestions,
  showAutocomplete,
  autocompleteItems,
  applyAutocomplete,
  placeholder,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
      e.currentTarget.style.height = 'auto';
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-[#030712] via-[#030712]/95 to-transparent backdrop-blur-sm">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2.5 mb-4 max-w-full mx-auto px-2">
          {suggestions.map((s) => (
            <button
              key={s}
              className="group flex items-center gap-2.5 text-[11px] bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-500 rounded-xl px-5 py-2.5 transition-all shadow-xl active:scale-95"
              onClick={() => onSend(s)}
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
          <textarea
            className="bg-transparent border-none focus:ring-0 text-[15px] text-white placeholder-slate-500 flex-1 py-3 outline-none resize-none custom-scrollbar"
            style={{ minHeight: '48px', maxHeight: '160px' }}
            rows={1}
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isAnalyzing || isReadOnly}
          />

          <AnimatePresence>
            {showAutocomplete && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full mb-3 left-0 w-64 bg-[#0B0F19] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-2 border-b border-white/5 bg-white/5">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-2">Suggestions</span>
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
              disabled={isAnalyzing || isReadOnly}
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
                input.trim() && !isAnalyzing && !isReadOnly
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95" 
                  : "bg-white/5 text-slate-700 cursor-not-allowed"
              }`}
              onClick={() => onSend()} 
              disabled={isAnalyzing || !input.trim() || isReadOnly}
            >
              <span className="hidden sm:inline text-xs uppercase tracking-widest">Analyze</span>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
