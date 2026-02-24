"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { ComposePopup } from "./compose-popup";

interface ComposeInstance {
  id: string;
  minimized: boolean;
  betreff: string;
}

interface ComposeManagerContextType {
  openCompose: () => void;
  instances: ComposeInstance[];
}

const ComposeManagerContext = createContext<ComposeManagerContextType>({
  openCompose: () => {},
  instances: [],
});

export function useComposeManager() {
  return useContext(ComposeManagerContext);
}

const MAX_COMPOSE_INSTANCES = 5;

interface ComposeManagerProps {
  children: ReactNode;
}

export function ComposeManager({ children }: ComposeManagerProps) {
  const [instances, setInstances] = useState<ComposeInstance[]>([]);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  const openCompose = useCallback(() => {
    setInstances((prev) => {
      if (prev.length >= MAX_COMPOSE_INSTANCES) {
        // Max concurrent composes reached
        return prev;
      }
      const newId = `compose-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return [
        ...prev,
        { id: newId, minimized: false, betreff: "" },
      ];
    });
  }, []);

  const minimizeCompose = useCallback((id: string) => {
    setInstances((prev) =>
      prev.map((inst) =>
        inst.id === id ? { ...inst, minimized: true } : inst
      )
    );
    setMaximizedId((prev) => (prev === id ? null : prev));
  }, []);

  const maximizeCompose = useCallback((id: string) => {
    setInstances((prev) =>
      prev.map((inst) =>
        inst.id === id ? { ...inst, minimized: false } : inst
      )
    );
    setMaximizedId((prev) => (prev === id ? null : id));
  }, []);

  const restoreCompose = useCallback((id: string) => {
    setInstances((prev) =>
      prev.map((inst) =>
        inst.id === id ? { ...inst, minimized: false } : inst
      )
    );
  }, []);

  const closeCompose = useCallback((id: string) => {
    setInstances((prev) => prev.filter((inst) => inst.id !== id));
    setMaximizedId((prev) => (prev === id ? null : prev));
  }, []);

  return (
    <ComposeManagerContext.Provider value={{ openCompose, instances }}>
      {children}

      {/* Render active (non-minimized) compose popups */}
      {instances
        .filter((inst) => !inst.minimized)
        .map((inst, index) => (
          <ComposePopup
            key={inst.id}
            id={inst.id}
            onMinimize={() => minimizeCompose(inst.id)}
            onMaximize={() => maximizeCompose(inst.id)}
            onClose={() => closeCompose(inst.id)}
            isMaximized={maximizedId === inst.id}
          />
        ))}

      {/* Minimized compose tabs at bottom-right */}
      {instances.some((inst) => inst.minimized) && (
        <div className="fixed bottom-0 right-4 z-[85] flex items-end gap-1">
          {instances
            .filter((inst) => inst.minimized)
            .map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => restoreCompose(inst.id)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 dark:bg-slate-950 text-white text-xs font-medium rounded-t-lg shadow-lg hover:bg-slate-700 dark:hover:bg-slate-900 transition-colors max-w-[200px] group"
              >
                <span className="truncate">
                  {inst.betreff || "Neue Nachricht"}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeCompose(inst.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-white transition-opacity ml-1"
                >
                  &times;
                </button>
              </button>
            ))}
        </div>
      )}
    </ComposeManagerContext.Provider>
  );
}
