"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { FolderTree } from "@/components/email/folder-tree";
import { EmailList } from "@/components/email/email-list";
import { EmailDetail } from "@/components/email/email-detail";
import { VeraktungPanel } from "@/components/email/veraktung-panel";
import { TicketFromEmailDialog } from "@/components/email/ticket-from-email-dialog";
import { useEmailStore } from "@/hooks/use-email-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useSocket } from "@/components/socket-provider";

/**
 * Three-pane resizable inbox layout.
 * Left: folder tree. Center: email list. Right: email detail.
 * Panel sizes persist in localStorage via autoSaveId.
 * Includes Veraktung slide-over panel and Ticket-from-Email dialog.
 */
export function InboxLayout() {
  const emailStore = useEmailStore();
  const { socket, isConnected } = useSocket();

  // Join/leave mailbox room for real-time email updates (INT-001)
  useEffect(() => {
    if (!socket || !isConnected || !emailStore.selectedKontoId) return;

    const kontoId = emailStore.selectedKontoId;
    socket.emit("join:mailbox", kontoId);

    return () => {
      socket.emit("leave:mailbox", kontoId);
    };
  }, [socket, isConnected, emailStore.selectedKontoId]);

  // Bridge Socket.IO email:folder-update to window CustomEvent for folder-tree (INT-001)
  useEffect(() => {
    if (!socket) return;

    const handleFolderUpdate = (data: {
      kontoId: string;
      ordnerId: string;
      ungeleseneAnzahl: number;
    }) => {
      window.dispatchEvent(
        new CustomEvent("email:folder-update", { detail: data })
      );
    };

    socket.on("email:folder-update", handleFolderUpdate);
    return () => {
      socket.off("email:folder-update", handleFolderUpdate);
    };
  }, [socket]);

  // Veraktung panel state
  const [veraktungOpen, setVeraktungOpen] = useState(false);
  const [veraktungEmailIds, setVeraktungEmailIds] = useState<string[]>([]);

  // Ticket dialog state
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketEmailId, setTicketEmailId] = useState<string | null>(null);

  // Register Gmail-style keyboard shortcuts
  useKeyboardShortcuts(emailStore);

  // Open veraktung panel for a single email
  const handleOpenVeraktung = useCallback((emailId: string) => {
    setVeraktungEmailIds([emailId]);
    setVeraktungOpen(true);
  }, []);

  // Close veraktung panel
  const handleCloseVeraktung = useCallback(() => {
    setVeraktungOpen(false);
    setVeraktungEmailIds([]);
  }, []);

  // On veraktung complete, refresh the email list
  const handleVeraktungComplete = useCallback(() => {
    // Trigger re-render by toggling a filter or similar
    // The simplest approach: the email detail will refetch on its own
  }, []);

  // Open ticket dialog for a single email
  const handleOpenTicket = useCallback((emailId: string) => {
    setTicketEmailId(emailId);
    setTicketOpen(true);
  }, []);

  // Close ticket dialog
  const handleCloseTicket = useCallback(() => {
    setTicketOpen(false);
    setTicketEmailId(null);
  }, []);

  return (
    <>
      <ResizablePanelGroup
        orientation="horizontal"
        autoSaveId="email-inbox-layout"
        className="h-full"
      >
        {/* Left: Folder Tree */}
        <ResizablePanel
          id="folder-tree"
          defaultSize={20}
          minSize={15}
          maxSize={30}
          className="bg-slate-50 dark:bg-slate-900/50"
        >
          <FolderTree
            selectedKontoId={emailStore.selectedKontoId}
            selectedOrdnerId={emailStore.selectedOrdnerId}
            onSelectFolder={emailStore.selectFolder}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* Center: Email List */}
        <ResizablePanel
          id="email-list"
          defaultSize={35}
          minSize={25}
        >
          <EmailList
            selectedKontoId={emailStore.selectedKontoId}
            selectedOrdnerId={emailStore.selectedOrdnerId}
            selectedEmailId={emailStore.selectedEmailId}
            filters={emailStore.filters}
            checkedEmailIds={emailStore.checkedEmailIds}
            onSelectEmail={emailStore.selectEmail}
            onToggleCheck={emailStore.toggleCheck}
            onToggleCheckRange={emailStore.toggleCheckRange}
            onClearChecked={emailStore.clearChecked}
            onCheckAll={emailStore.checkAll}
            onUpdateFilters={emailStore.updateFilters}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Email Detail */}
        <ResizablePanel
          id="email-detail"
          defaultSize={45}
          minSize={30}
        >
          <EmailDetail
            emailId={emailStore.selectedEmailId}
            onSelectEmail={emailStore.selectEmail}
            onOpenVeraktung={handleOpenVeraktung}
            onOpenTicket={handleOpenTicket}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Veraktung slide-over panel */}
      <VeraktungPanel
        open={veraktungOpen}
        onClose={handleCloseVeraktung}
        emailIds={veraktungEmailIds}
        onVeraktungComplete={handleVeraktungComplete}
      />

      {/* Ticket-from-Email dialog */}
      {ticketEmailId && (
        <TicketFromEmailDialog
          open={ticketOpen}
          onClose={handleCloseTicket}
          emailId={ticketEmailId}
        />
      )}
    </>
  );
}
