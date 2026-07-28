import { create } from 'zustand';

interface NavigationRoute {
  path: string;
  label: string;
  state?: {
    stepIndex?: number;
    formData?: Record<string, string>;
    [key: string]: any;
  };
}

interface NavigationStore {
  algorithmsBackRoute: NavigationRoute | null;
  setAlgorithmsBackRoute: (route: NavigationRoute | null) => void;
  materialsBackRoute: NavigationRoute | null;
  setMaterialsBackRoute: (route: NavigationRoute | null) => void;
  step1BackRoute: NavigationRoute | null;
  setStep1BackRoute: (route: NavigationRoute | null) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  algorithmsBackRoute: null,
  setAlgorithmsBackRoute: (route) => set({ algorithmsBackRoute: route }),
  materialsBackRoute: null,
  setMaterialsBackRoute: (route) => set({ materialsBackRoute: route }),
  step1BackRoute: null,
  setStep1BackRoute: (route) => set({ step1BackRoute: route }),
}));
