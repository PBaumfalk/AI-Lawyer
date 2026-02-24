"use client";

import { useCallback, useEffect, useState } from "react";
import { GripVertical } from "lucide-react";
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

/**
 * shadcn-style wrapper around react-resizable-panels v4.
 * Provides ResizablePanelGroup (with optional localStorage persistence),
 * ResizablePanel, and ResizableHandle.
 */

interface ResizablePanelGroupProps extends GroupProps {
  /** When provided, panel layout is saved to localStorage under this key. */
  autoSaveId?: string;
}

const ResizablePanelGroup = ({
  className,
  autoSaveId,
  defaultLayout,
  onLayoutChanged,
  ...props
}: ResizablePanelGroupProps) => {
  const [savedLayout, setSavedLayout] = useState<
    Record<string, number> | undefined
  >(undefined);

  // Restore from localStorage on mount
  useEffect(() => {
    if (!autoSaveId) return;
    try {
      const stored = localStorage.getItem(`resizable-layout:${autoSaveId}`);
      if (stored) {
        setSavedLayout(JSON.parse(stored));
      }
    } catch {
      // localStorage not available
    }
  }, [autoSaveId]);

  const handleLayoutChanged = useCallback(
    (layout: Record<string, number>) => {
      if (autoSaveId) {
        try {
          localStorage.setItem(
            `resizable-layout:${autoSaveId}`,
            JSON.stringify(layout)
          );
        } catch {
          // localStorage not available
        }
      }
      onLayoutChanged?.(layout);
    },
    [autoSaveId, onLayoutChanged]
  );

  return (
    <Group
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      defaultLayout={savedLayout ?? defaultLayout}
      onLayoutChanged={handleLayoutChanged}
      {...props}
    />
  );
};

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      "relative flex w-px items-center justify-center bg-slate-200 dark:bg-slate-700 after:absolute after:inset-y-0 after:-left-1 after:-right-1 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 data-[resize-handle-state=hover]:bg-brand-400 data-[resize-handle-state=drag]:bg-brand-600 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:right-0 data-[panel-group-direction=vertical]:after:-top-1 data-[panel-group-direction=vertical]:after:-bottom-1 [&[data-panel-group-direction=vertical]>div]:rotate-90 transition-colors",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
        <GripVertical className="h-2.5 w-2.5 text-slate-400" />
      </div>
    )}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
