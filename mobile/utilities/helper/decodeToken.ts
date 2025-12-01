import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  exp: number;
  iat: number;
  address: string;
  role: string;
  shopId?: string;
}

export async function decodeToken(accessToken: string): Promise<void> {
  try {
    // Decode and log token expiry for debugging
    try {
      const decoded = jwtDecode<DecodedToken>(accessToken);
      const expiryDate = new Date(decoded.exp * 1000);
      console.log(
        "[ApiClient] Token set, expires at:",
        expiryDate.toLocaleString()
      );
    } catch (e) {
      console.log("[ApiClient] Token set (unable to decode)");
    }
  } catch (error) {
    console.error("Failed to set auth token:", error);
  }
}
