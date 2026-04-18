const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
);
apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
apiUrl.pathname = "";
apiUrl.search = "";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || apiUrl.toString().replace(/\/$/, "");
