import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  type?: "danger" | "info";
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  confirmLabel = "Confirm", 
  cancelLabel = "Cancel", 
  onConfirm,
  type = "danger" 
}: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden pointer-events-auto"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${type === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                    <AlertTriangle size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="px-8 pb-8">
                <p className="text-slate-400 leading-relaxed text-sm">
                  {message}
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-white transition-all"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-lg ${
                    type === 'danger' 
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
