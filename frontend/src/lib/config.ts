const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const getApiUrl = (path: string) => {
  return `${API_BASE_URL}${path}`;
};

const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

export const getWsUrl = (path: string) => {
  return `${WS_BASE_URL}${path}`; // Use WS_BASE_URL for WebSocket connections
};
