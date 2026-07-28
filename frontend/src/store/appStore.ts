import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Property } from '@/types';
import type { MapCenter, MapMarker } from '@/components/ui/MapView';

export interface SelectedLocation {
  address: string;
  latitude: number;
  longitude: number;
}

export interface Step1Snapshot {
  searchQuery: string;
  selectedProperty: Property;
  mapCenter: MapCenter | null;
  mapMarkers: MapMarker[];
  clickedPoint: { x: number; y: number } | null;
  geoFailed: string[];
  radiusM: number;
  cadastralError: string | null;
  cadastralMessage: string | null;
}

interface AppState {
  activeStep: number;
  selectedLocation: SelectedLocation | null;
  step1Snapshot: Step1Snapshot | null;
  sidebarCollapsed: boolean;
  isSurveyCompleted: boolean;
  surveyFormData: Record<string, string>;
  checkedDocuments: string[];
  checkedAlgorithms: Record<string, string[]>;

  setActiveStep: (step: number) => void;
  setSelectedLocation: (location: SelectedLocation | null) => void;
  setStep1Snapshot: (snapshot: Step1Snapshot | null) => void;
  toggleSidebar: () => void;
  setSurveyCompleted: (completed: boolean) => void;
  setSurveyFormData: (data: Record<string, string>) => void;
  toggleDocument: (docId: string) => void;
  setCheckedDocuments: (ids: string[]) => void;
  toggleAlgorithmStep: (algorithmId: string, stepId: string) => void;
  setCheckedAlgorithmSteps: (algorithmId: string, stepIds: string[]) => void;
  resetSession: () => void;
}

const initialState = {
  activeStep: 0,
  selectedLocation: null as SelectedLocation | null,
  step1Snapshot: null as Step1Snapshot | null,
  sidebarCollapsed: false,
  isSurveyCompleted: false,
  surveyFormData: {} as Record<string, string>,
  checkedDocuments: [] as string[],
  checkedAlgorithms: {} as Record<string, string[]>,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      setActiveStep: (step) => set({ activeStep: step }),
      setSelectedLocation: (location) => set({ selectedLocation: location }),
      setStep1Snapshot: (snapshot) => set({ step1Snapshot: snapshot }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSurveyCompleted: (completed) => set({ isSurveyCompleted: completed }),
      setSurveyFormData: (data) => set({ surveyFormData: data }),

      toggleDocument: (docId) =>
        set((state) => {
          const docs = state.checkedDocuments.includes(docId)
            ? state.checkedDocuments.filter((id) => id !== docId)
            : [...state.checkedDocuments, docId];
          return { checkedDocuments: docs };
        }),

      setCheckedDocuments: (ids) => set({ checkedDocuments: ids }),

      toggleAlgorithmStep: (algorithmId, stepId) =>
        set((state) => {
          const currentSteps = state.checkedAlgorithms[algorithmId] || [];
          const newSteps = currentSteps.includes(stepId)
            ? currentSteps.filter((id) => id !== stepId)
            : [...currentSteps, stepId];
          return {
            checkedAlgorithms: {
              ...state.checkedAlgorithms,
              [algorithmId]: newSteps,
            },
          };
        }),

      setCheckedAlgorithmSteps: (algorithmId, stepIds) =>
        set((state) => ({
          checkedAlgorithms: {
            ...state.checkedAlgorithms,
            [algorithmId]: stepIds,
          },
        })),

      resetSession: () => set({ ...initialState }),
    }),
    {
      name: 'atlas-app',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        selectedLocation: state.selectedLocation,
        step1Snapshot: state.step1Snapshot,
        isSurveyCompleted: state.isSurveyCompleted,
        surveyFormData: state.surveyFormData,
        checkedDocuments: state.checkedDocuments,
        checkedAlgorithms: state.checkedAlgorithms,
      }),
    }
  )
);
