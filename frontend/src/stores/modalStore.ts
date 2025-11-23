import { create } from 'zustand';

interface ModalStore {
  isWelcomeModalOpen: boolean;
  openWelcomeModal: () => void;
  closeWelcomeModal: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  isWelcomeModalOpen: false,
  openWelcomeModal: () => set({ isWelcomeModalOpen: true }),
  closeWelcomeModal: () => set({ isWelcomeModalOpen: false }),
}));
