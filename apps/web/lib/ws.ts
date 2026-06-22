import { API_URL } from "@/lib/config";

/**
 * Builds the board WebSocket URL. Browsers can't set an Authorization header on
 * a WebSocket, so the access token rides in a query param (the server's
 * WSUpgradeGuard validates it before upgrading). http(s) -> ws(s).
 */
export function boardSocketUrl(projectId: string, token: string): string {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/projects/${projectId}/board/ws?token=${encodeURIComponent(token)}`;
}
