import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Layout, 
  Trash2, 
  ExternalLink, 
  Clock, 
  Database,
  Loader2,
  Sparkles,
  Search,
  GripVertical
} from "lucide-react";
import { listPinnedInsights, unpinInsight } from "@/lib/api";
import PlotlyChart from "./PlotlyChart";
import ConfirmModal from "./ConfirmModal";
import { useStore } from "@/hooks/useStore";
import {
  DndContext, 
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PinnedInsight {
  id: string;
  dataset_key: string;
  filename: string;
  query: string;
  chart_spec: any;
  narration: string;
  created_at: string;
}

interface Props {
  isActive?: boolean;
}

function SortableInsight({ insight, onDelete }: { insight: PinnedInsight, onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: insight.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative overflow-hidden bg-[#0B0F19]/40 backdrop-blur-2xl border border-white/5 hover:border-indigo-500/30 transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2.5rem] group flex flex-col h-full"
      >
        {/* Card Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/5 blur-[80px] pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-700" />
        
        <div className="p-8 border-b border-white/5 flex items-start justify-between gap-6 relative z-10">
          <div className="flex gap-5">
            <div 
              {...attributes} 
              {...listeners}
              className="mt-1 p-2 text-slate-600 hover:text-indigo-400 cursor-grab active:cursor-grabbing shrink-0 bg-white/5 rounded-xl transition-colors"
            >
              <GripVertical size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">{insight.filename}</span>
                </div>
                <span className="text-slate-700 text-xs">•</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Statistical Insight</span>
              </div>
              <h4 className="text-xl md:text-2xl font-black text-white leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-indigo-400 transition-all duration-500">{insight.query}</h4>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 transition-transform duration-300">
            <button 
              onClick={() => onDelete(insight.id)}
              className="p-3 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-2xl transition-all border border-transparent hover:border-rose-500/20"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 w-full bg-black/10 p-4 min-h-[380px] flex items-center justify-center relative overflow-hidden min-w-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03)_0%,transparent_100%)] pointer-events-none" />
          <div className="w-full">
            <PlotlyChart 
              spec={insight.chart_spec} 
              height={380} 
            />
          </div>
        </div>

        {insight.narration && (
          <div className="p-8 bg-white/[0.02] border-t border-white/5 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em]">AI Synthesis</span>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-[1.7] line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
              {insight.narration}
            </p>
            <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-slate-600 uppercase tracking-widest">
                <Clock size={12} className="text-slate-700" /> 
                Snapshot: {new Date(insight.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <div className="text-xs font-black text-slate-700 uppercase tracking-[0.3em]">
                Nexlytics Global
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function LiveBoard({ isActive }: Props) {
  const { pinnedInsights, setPinnedInsights, removePinnedInsight } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listPinnedInsights();
      setPinnedInsights(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [setPinnedInsights]);

  useEffect(() => {
    if (isActive && pinnedInsights.length === 0) {
      fetchInsights();
    }
  }, [isActive, pinnedInsights.length, fetchInsights]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      // Optimistic update
      removePinnedInsight(deleteId);
      await unpinInsight(deleteId);
      setDeleteId(null);
    } catch (err: any) {
      // Rollback would be nice but for now we just alert
      alert("Failed to delete insight: " + err.message);
      fetchInsights(); // Refresh from server
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = pinnedInsights.findIndex((i) => i.id === active.id);
      const newIndex = pinnedInsights.findIndex((i) => i.id === over.id);
      setPinnedInsights(arrayMove(pinnedInsights, oldIndex, newIndex));
    }
  }

  const filteredInsights = pinnedInsights.filter(i => 
    i.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && pinnedInsights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="text-indigo-500 animate-spin mb-4" size={40} />
        <p className="text-slate-400 font-medium">Loading your command center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-indigo-400 font-black text-[11px] uppercase tracking-[0.3em] mb-2">
            <Layout size={14} /> Intelligence Hub
          </div>
          <h2 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tighter mb-4">Command Center</h2>
          <p className="text-slate-500 max-w-xl text-lg font-medium leading-relaxed">
            Your global epicenter for cross-dataset intelligence and persistent insights.
          </p>
        </div>

        <div className="relative group w-full md:w-80">
          <div className="absolute inset-y-0 left-4 flex items-center text-slate-500 group-focus-within:text-indigo-400 transition-colors">
            <Search size={18} />
          </div>
          <input 
            type="text"
            placeholder="Search insights..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
          />
        </div>
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={filteredInsights.map(i => i.id)}
          strategy={rectSortingStrategy}
        >
          <AnimatePresence mode="popLayout">
            {filteredInsights.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-40 bg-[#0B0F19]/40 border border-white/5 border-dashed rounded-[4rem] shadow-2xl relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03)_0%,transparent_100%)] pointer-events-none" />
                <div className="w-24 h-24 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-indigo-500/20 text-indigo-400 shadow-inner group">
                  <Sparkles size={40} className="group-hover:rotate-12 transition-transform duration-500" />
                </div>
                <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Intelligence hub empty</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed font-medium">
                  Pin your critical findings from the AI Analyst to build your personalized command center.
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {filteredInsights.map((insight) => (
                  <SortableInsight 
                    key={insight.id} 
                    insight={insight} 
                    onDelete={(id) => setDeleteId(id)} 
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </SortableContext>
      </DndContext>

      <ConfirmModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remove from Dashboard"
        message="Are you sure you want to remove this insight? It will be permanently deleted from your live board."
        confirmLabel="Remove"
        type="danger"
      />
    </div>
  );
}
