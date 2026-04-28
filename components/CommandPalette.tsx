import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Search, Database, MessageSquare, TrendingUp, FileText, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onSelectTab: (tab: string) => void;
  datasets: { key: string; label: string }[];
  onSelectDataset: (key: string) => void;
}

export const CommandPalette = ({ onSelectTab, datasets, onSelectDataset }: Props) => {
  const [open, setOpen] = useState(false);

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" 
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="w-full max-w-[640px] bg-[#0B0F19] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto z-10"
          >
            <Command className="flex flex-col h-full">
              <div className="flex items-center border-b border-white/5 px-4">
                <Search className="text-slate-500 mr-3" size={20} />
                <Command.Input 
                  placeholder="Search actions, datasets, and tabs..." 
                  className="w-full bg-transparent border-none focus:ring-0 py-4 text-white placeholder-slate-600 outline-none text-[15px]"
                />
              </div>

              <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-hide">
                <Command.Empty className="px-4 py-8 text-center text-slate-500 text-sm">
                  No results found.
                </Command.Empty>

                <Command.Group heading={<span className="px-3 py-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Navigation</span>}>
                  <CommandItem onSelect={() => { onSelectTab('overview'); setOpen(false); }}>
                    <Database size={18} className="mr-3 text-slate-400" />
                    <span>Data Overview</span>
                  </CommandItem>
                  <CommandItem onSelect={() => { onSelectTab('analyst'); setOpen(false); }}>
                    <MessageSquare size={18} className="mr-3 text-slate-400" />
                    <span>AI Analyst</span>
                  </CommandItem>
                  <CommandItem onSelect={() => { onSelectTab('forecast'); setOpen(false); }}>
                    <TrendingUp size={18} className="mr-3 text-slate-400" />
                    <span>Forecasting</span>
                  </CommandItem>
                  <CommandItem onSelect={() => { onSelectTab('reports'); setOpen(false); }}>
                    <FileText size={18} className="mr-3 text-slate-400" />
                    <span>Reports</span>
                  </CommandItem>
                  <CommandItem onSelect={() => { onSelectTab('board'); setOpen(false); }}>
                    <LayoutDashboard size={18} className="mr-3 text-slate-400" />
                    <span>Live Board</span>
                  </CommandItem>
                </Command.Group>

                {datasets.length > 0 && (
                  <Command.Group heading={<span className="px-3 py-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-2 block">Datasets</span>}>
                    {datasets.map((d) => (
                      <CommandItem key={d.key} onSelect={() => { onSelectDataset(d.key); setOpen(false); }}>
                        <Database size={18} className="mr-3 text-emerald-500/50" />
                        <span>{d.label}</span>
                      </CommandItem>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              <div className="p-3 border-t border-white/5 bg-black/20 flex items-center justify-between text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px]">ENTER</kbd> to select</span>
                  <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px]">ESC</kbd> to close</span>
                </div>
                <span>Nexlytics Quick Search</span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

function CommandItem({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center px-3 py-3 rounded-xl cursor-pointer text-slate-300 aria-selected:bg-indigo-600 aria-selected:text-white transition-all group"
    >
      {children}
    </Command.Item>
  );
}
