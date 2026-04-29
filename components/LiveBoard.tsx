import { useState, useEffect } from "react";
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
        className="glass-card group flex flex-col h-full overflow-hidden border-white/5 hover:border-indigo-500/30 transition-all duration-500 shadow-2xl relative"
      >
        <div className="p-6 border-b border-white/5 flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <div 
              {...attributes} 
              {...listeners}
              className="p-1.5 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0"
            >
              <GripVertical size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-indigo-500/10 p-1.5 rounded-lg border border-indigo-500/20">
                  <Database size={14} className="text-indigo-400" />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{insight.filename}</span>
              </div>
              <h4 className="text-lg font-bold text-white leading-tight group-hover:text-indigo-400 transition-colors">{insight.query}</h4>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => onDelete(insight.id)}
              className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-black/20 p-2 min-h-[350px]">
          <PlotlyChart 
            spec={insight.chart_spec} 
            height={350} 
          />
        </div>

        {insight.narration && (
          <div className="p-6 bg-[#0B0F19]/50 backdrop-blur-xl border-t border-white/5">
            <div className="flex items-center gap-2 mb-3 text-indigo-400/60 text-[10px] font-bold uppercase tracking-widest">
              <Sparkles size={12} /> AI Insight
            </div>
            <p className="text-slate-400 text-sm leading-relaxed line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
              {insight.narration}
            </p>
            <div className="mt-4 pt-4 border-t border-white/[0.03] flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              <div className="flex items-center gap-1.5">
                <Clock size={12} /> {new Date(insight.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function LiveBoard({ isActive }: Props) {
  const [insights, setInsights] = useState<PinnedInsight[]>([]);
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

  useEffect(() => {
    if (isActive) {
      fetchInsights();
    }
  }, [isActive]);

  // Listen for global pin changes so the LiveBoard refreshes in real-time
  useEffect(() => {
    function onPinnedChange() {
      if (isActive) fetchInsights();
    }
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("pinned_insights:changed", onPinnedChange);
    }
    return () => {
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("pinned_insights:changed", onPinnedChange);
      }
    };
  }, [isActive]);

  async function fetchInsights() {
    try {
      setLoading(true);
      const data = await listPinnedInsights();
      setInsights(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await unpinInsight(deleteId);
      setInsights(prev => prev.filter(i => i.id !== deleteId));
      setDeleteId(null);
    } catch (err: any) {
      alert("Failed to delete insight: " + err.message);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setInsights((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const filteredInsights = insights.filter(i => 
    i.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && insights.length === 0) {
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
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
            <Layout size={14} /> Global Dashboard
          </div>
          <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">Command Center</h2>
          <p className="text-slate-400 max-w-xl text-lg leading-relaxed">
            Your personal hub of cross-dataset intelligence. All your pinned insights in one dynamic view.
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-32 bg-white/[0.02] border border-white/5 border-dashed rounded-[3rem]"
              >
                <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10 text-slate-500">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Pinned Insights</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                  Start a conversation with the AI Analyst and pin charts to see them here.
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
