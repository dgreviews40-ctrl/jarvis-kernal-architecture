/**
 * UI State Store
 * 
 * Manages UI-related state:
 * - View modes (DASHBOARD, SETTINGS, DEV, INTEGRATIONS)
 * - Active tabs (DASHBOARD, ARCH, MEMORY, VISION, HEALTH, GRAPH, LOGS, HOME_ASSISTANT, WEATHER, AGENT)
 * - Modal visibility
 * - System ready state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MainView = 'DASHBOARD' | 'SETTINGS' | 'DEV' | 'INTEGRATIONS' | 'PERFORMANCE' | 'MARKETPLACE' | 'VECTOR_DB' | 'REALTIME' | 'VISION_MEMORY' | 'MODEL_MANAGER' | 'GPU_DASHBOARD';
export type TabView = 'DASHBOARD' | 'ARCH' | 'MEMORY' | 'VISION' | 'HEALTH' | 'GRAPH' | 'LOGS' | 'HOME_ASSISTANT' | 'WEATHER' | 'AGENT';

interface UIState {
  // View state
  mainView: MainView;
  activeTab: TabView;
  isSystemReady: boolean;
  
  // Modal states
  showBootSequence: boolean;
  activeModal: string | null;
  modalData: unknown;
  
  // Actions
  setMainView: (view: MainView) => void;
  setActiveTab: (tab: TabView) => void;
  setSystemReady: (ready: boolean) => void;
  openModal: (modal: string, data?: unknown) => void;
  closeModal: () => void;
  resetUI: () => void;
}

const initialState = {
  mainView: 'DASHBOARD' as MainView,
  activeTab: 'DASHBOARD' as TabView,
  isSystemReady: false,
  showBootSequence: true,
  activeModal: null,
  modalData: null,
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      ...initialState,
      
      setMainView: (view) => set({ mainView: view }),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      setSystemReady: (ready) => set({ 
        isSystemReady: ready,
        showBootSequence: !ready 
      }),
      
      openModal: (modal, data) => set({ 
        activeModal: modal, 
        modalData: data 
      }),
      
      closeModal: () => set({ 
        activeModal: null, 
        modalData: null 
      }),
      
      resetUI: () => set({
        ...initialState,
        showBootSequence: false,
      }),
    }),
    {
      name: 'jarvis-ui-store',
      partialize: (state) => ({ 
        mainView: state.mainView,
        activeTab: state.activeTab,
      }),
    }
  )
);
