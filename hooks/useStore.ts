import { create } from 'zustand';
import type { User, DatasetPayload, ChatSession, DatasetInfo } from '@/lib/types';

export type Tab = "overview" | "analyst" | "forecast" | "reports" | "board";

interface AppState {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;

  // Navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Data
  datasetPayload: DatasetPayload | null;
  setDatasetPayload: (payload: DatasetPayload | null) => void;
  
  // Sessions
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  chatSessions: ChatSession[];
  setChatSessions: (sessions: ChatSession[] | ((prev: ChatSession[]) => ChatSession[])) => void;

  // Data Management
  availableDatasets: DatasetInfo[];
  setAvailableDatasets: (datasets: DatasetInfo[]) => void;
  dataSource: "upload" | "preloaded";
  setDataSource: (source: "upload" | "preloaded") => void;
  selectedKeys: string[];
  setSelectedKeys: (keys: string[]) => void;
  loadingDataset: boolean;
  setLoadingDataset: (loading: boolean) => void;
  datasetError: string;
  setDatasetError: (error: string) => void;
  pendingDatasetToActivate: DatasetPayload | null;
  setPendingDatasetToActivate: (payload: DatasetPayload | null) => void;

  // Global Insights
  pinnedInsights: any[];
  setPinnedInsights: (insights: any[]) => void;
  addPinnedInsight: (insight: any) => void;
  removePinnedInsight: (id: string) => void;
}

import { persist, createJSONStorage } from 'zustand/middleware';

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),

      activeTab: "overview",
      setActiveTab: (activeTab) => set({ activeTab }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      datasetPayload: null,
      setDatasetPayload: (datasetPayload) => set({ datasetPayload }),

      activeSessionId: null,
      setActiveSessionId: (activeSessionId) => set({ activeSessionId }),

      chatSessions: [],
      setChatSessions: (sessions) => 
        set((state) => ({ 
          chatSessions: typeof sessions === 'function' ? sessions(state.chatSessions) : sessions 
        })),

      availableDatasets: [],
      setAvailableDatasets: (availableDatasets) => set({ availableDatasets }),
      dataSource: "preloaded",
      setDataSource: (dataSource) => set({ dataSource }),
      selectedKeys: [],
      setSelectedKeys: (selectedKeys) => set({ selectedKeys }),
      loadingDataset: false,
      setLoadingDataset: (loadingDataset) => set({ loadingDataset }),
      datasetError: "",
      setDatasetError: (datasetError) => set({ datasetError }),
      pendingDatasetToActivate: null,
      setPendingDatasetToActivate: (pendingDatasetToActivate) => set({ pendingDatasetToActivate }),

      pinnedInsights: [],
      setPinnedInsights: (pinnedInsights) => set({ pinnedInsights }),
      addPinnedInsight: (insight) => set((state) => ({ 
        pinnedInsights: [...state.pinnedInsights, insight] 
      })),
      removePinnedInsight: (id) => set((state) => ({ 
        pinnedInsights: state.pinnedInsights.filter(i => i.id !== id) 
      })),
    }),
    {
      name: 'nexlytics-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist non-heavy state items
      partialize: (state) => ({ 
        activeTab: state.activeTab,
        sidebarCollapsed: state.sidebarCollapsed,
        activeSessionId: state.activeSessionId,
        dataSource: state.dataSource,
        selectedKeys: state.selectedKeys
      }),
    }
  )
);
