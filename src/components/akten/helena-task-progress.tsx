"use client";

import { Loader2 } from "lucide-react";

export interface TaskProgress {
  taskId: string;
  auftrag: string;
  step: number;
  maxSteps: number;
  toolName: string | null;
}

interface HelenaTaskProgressProps {
  tasks: Map<string, TaskProgress>;
}

export function HelenaTaskProgress({ tasks }: HelenaTaskProgressProps) {
  if (tasks.size === 0) return null;

  return (
    <>
      {Array.from(tasks.values()).map((task) => (
        <div
          key={task.taskId}
          className="glass-card rounded-xl p-4 border-l-2 border-l-[oklch(45%_0.2_260)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Helena denkt nach...
              </p>
              <p className="text-xs text-slate-500">
                Step {task.step}/{task.maxSteps}
                {task.toolName && (
                  <span className="ml-1">- {task.toolName}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
