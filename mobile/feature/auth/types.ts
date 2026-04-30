export type {
  CustomerFormData,
  ShopLocation,
  ShopFormData,
  Slide,
  NavigableSlideProps,
  FirstSlideProps,
  ThirdSlideProps,
  FourthSlideProps,
} from "./services/auth.interface";

export type AuthMethod =
  | "google"
  | "metamask"
  | "walletconnect"
  | "coinbase"
  | "rainbow"
  | null;
