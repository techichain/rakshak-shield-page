import { create } from 'zustand';
import type { AuthKey, StatusKey } from '@/types/rakshak';

interface Filters {
  auth: AuthKey | 'all';
  status: StatusKey | 'all';
  state: string;
  search: string;
}

interface RakshakState {
  filters: Filters;
  activeId: number | null;
  petitionOpen: boolean;
  reportOpen: boolean;
  reportLocId: number | null;
  setFilter: (key: keyof Filters, value: string) => void;
  setSearch: (s: string) => void;
  setActiveId: (id: number | null) => void;
  openPetition: (id?: number) => void;
  closePetition: () => void;
  openReport: (id: number) => void;
  closeReport: () => void;
}

export const useRakshakStore = create<RakshakState>((set, get) => ({
  filters: { auth: 'all', status: 'all', state: 'all', search: '' },
  activeId: null,
  petitionOpen: false,
  reportOpen: false,
  reportLocId: null,
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } as Filters })),
  setSearch: (search) => set((s) => ({ filters: { ...s.filters, search } })),
  setActiveId: (id) => set({ activeId: id }),
  openPetition: (id) => {
    const useId = id ?? get().activeId ?? 1;
    set({ petitionOpen: true, activeId: useId });
  },
  closePetition: () => set({ petitionOpen: false }),
  openReport: (id) => set({ reportOpen: true, reportLocId: id }),
  closeReport: () => set({ reportOpen: false, reportLocId: null }),
}));
