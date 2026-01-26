import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface ModalState {
  // Subscription Modal
  showSubscriptionModal: boolean;
  subscriptionModalLoading: boolean;
  setShowSubscriptionModal: (show: boolean) => void;
  setSubscriptionModalLoading: (loading: boolean) => void;

  // Generic Modal (for future use)
  activeModal: string | null;
  modalData: any;
  openModal: (modalName: string, data?: any) => void;
  closeModal: () => void;
  closeAllModals: () => void;
}

export const useModalStore = create<ModalState>()(
  devtools(
    (set) => ({
      // Subscription Modal State
      showSubscriptionModal: false,
      subscriptionModalLoading: false,
      setShowSubscriptionModal: (show: boolean) =>
        set(() => ({ showSubscriptionModal: show }), false, "setShowSubscriptionModal"),
      setSubscriptionModalLoading: (loading: boolean) =>
        set(() => ({ subscriptionModalLoading: loading }), false, "setSubscriptionModalLoading"),

      // Generic Modal State
      activeModal: null,
      modalData: null,
      openModal: (modalName: string, data: any = null) =>
        set(() => ({ activeModal: modalName, modalData: data }), false, "openModal"),
      closeModal: () =>
        set(() => ({ activeModal: null, modalData: null }), false, "closeModal"),
      closeAllModals: () =>
        set(
          () => ({
            showSubscriptionModal: false,
            subscriptionModalLoading: false,
            activeModal: null,
            modalData: null,
          }),
          false,
          "closeAllModals"
        ),
    }),
    { name: "modal-store" }
  )
);
