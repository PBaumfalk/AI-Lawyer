"use client";

// Placeholder -- fully implemented in Task 2
interface MessageViewProps {
  channelId: string;
  onMessageSent?: () => void;
}

export function MessageView({ channelId }: MessageViewProps) {
  return (
    <div className="flex-1 glass-card rounded-2xl flex items-center justify-center">
      <p className="text-sm text-muted-foreground">
        Nachrichten werden geladen...
      </p>
    </div>
  );
}
