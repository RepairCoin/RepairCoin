import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface AuthState {
  email: string,
  address: string,
  setEmail: (email: string) => void;
  setAddress: (address: string) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      email: "",
      address: "",

      setEmail: (email: string) => {
        set({ email }, false, "setEmail");
      },
      setAddress: (address: string) => {
        set({ address }, false, "setAddress");
      }
    })
  )
)