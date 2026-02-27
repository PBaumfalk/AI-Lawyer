"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

/**
 * Provides a Socket.IO client connection to the React tree.
 *
 * Connection strategy: same-origin with credentials (cookies).
 * The auth middleware on the server extracts the NextAuth session-token
 * from the cookie header automatically — no explicit token passing needed.
 *
 * Reconnection: built-in with exponential backoff (1s to 5s).
 * Cleanup: disconnects on unmount or session loss.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect when authenticated
    if (status !== "authenticated" || !session?.user) {
      // Disconnect if session is lost
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Avoid duplicate connections
    if (socketRef.current) return;

    // Probe Socket.IO endpoint before connecting to avoid error spam
    // in dev mode (npm run dev has no Socket.IO server)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    fetch("/socket.io/?EIO=4&transport=polling", {
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timeout);
        if (!res.ok) throw new Error("not available");

        const socket = io({
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          transports: ["websocket", "polling"],
        });

        socket.on("connect", () => setIsConnected(true));
        socket.on("disconnect", () => setIsConnected(false));
        socket.on("connect_error", () => setIsConnected(false));

        socketRef.current = socket;
      })
      .catch(() => {
        clearTimeout(timeout);
        // Socket.IO server not available — skip silently
      });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [status, session?.user]);

  return (
    <SocketContext.Provider
      value={{ socket: socketRef.current, isConnected }}
    >
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Hook to access the Socket.IO client instance and connection state.
 *
 * Returns `{ socket, isConnected }`.
 * `socket` may be null if not yet connected or not authenticated.
 */
export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
