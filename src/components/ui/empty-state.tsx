"use client";

import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  icon?: React.ElementType;
  onClick?: () => void;
  href?: string;
  roles?: string[]; // Only show for these UserRole values
}

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
}

export function EmptyState({ icon: Icon, title, description, actions }: EmptyStateProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role ?? "";

  const visibleActions = actions?.filter(
    (a) => !a.roles || a.roles.includes(userRole)
  );

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">{description}</p>
      {visibleActions && visibleActions.length > 0 && (
        <div className="flex items-center gap-2">
          {visibleActions.slice(0, 2).map((action) => {
            const ActionIcon = action.icon;
            const button = (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                onClick={action.onClick}
              >
                {ActionIcon && <ActionIcon className="w-4 h-4 mr-1.5" />}
                {action.label}
              </Button>
            );

            if (action.href) {
              return (
                <a key={action.label} href={action.href}>
                  {button}
                </a>
              );
            }

            return button;
          })}
        </div>
      )}
    </div>
  );
}
