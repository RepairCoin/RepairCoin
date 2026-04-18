let activeSocket: WebSocket | null = null;

export function setActiveSocket(ws: WebSocket | null): void {
  activeSocket = ws;
}

export function sendWS(message: { type: string; payload?: unknown }): boolean {
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return false;
  try {
    activeSocket.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}
