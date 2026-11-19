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
import { useSearchParams } from "next/navigation";
import { useComposeManager } from "@/components/email/compose-manager";
import { useIsMobile } from "@/hooks/use-media-query";
import { ArrowLeft, Folder } from "lucide-react";

/**
 * Three-pane resizable inbox layout.
 * Left: folder tree. Center: email list. Right: email detail.
 * Panel sizes persist in localStorage via autoSaveId.
 * Includes Veraktung slide-over panel and Ticket-from-Email dialog.
 */
export function InboxLayout() {
  const emailStore = useEmailStore();
  const { socket, isConnected } = useSocket();
  const searchParams = useSearchParams();
  const { openCompose } = useComposeManager();

  // Deep links: /email?emailId=… opens a mail, ?akteId=… filters by Akte,
  // ?compose=1 opens a new message (see src/lib/email/links.ts)
  const linkEmailId = searchParams.get("emailId");
  const linkAkteId = searchParams.get("akteId");
  const linkCompose = searchParams.get("compose");
  const { selectEmail, updateFilters } = emailStore;
  useEffect(() => {
    // updateFilters resets the selection, so apply the filter first
    if (linkAkteId) updateFilters({ akteId: linkAkteId });
    if (linkEmailId) selectEmail(linkEmailId);
  }, [linkAkteId, linkEmailId, selectEmail, updateFilters]);
  useEffect(() => {
    if (linkCompose === "1") openCompose();
  }, [linkCompose, openCompose]);

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

  // Open veraktung panel for several emails (bulk bar)
  const handleOpenVeraktungMulti = useCallback((emailIds: string[]) => {
    setVeraktungEmailIds(emailIds);
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

  // Below md only one pane is visible: folders, list or the open mail
  const isMobile = useIsMobile();
  const [mobileFolders, setMobileFolders] = useState(false);
  const handleSelectFolderMobile = useCallback(
    (kontoId: string | null, ordnerId: string | null) => {
      emailStore.selectFolder(kontoId, ordnerId);
      setMobileFolders(false);
    },
    [emailStore]
  );

  const emailList = (
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
      onVerakten={handleOpenVeraktungMulti}
    />
  );
  const emailDetail = (
    <EmailDetail
      emailId={emailStore.selectedEmailId}
      onSelectEmail={emailStore.selectEmail}
      onOpenVeraktung={handleOpenVeraktung}
      onOpenTicket={handleOpenTicket}
    />
  );

  const mobileBackButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-foreground hover:bg-muted"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      {label}
    </button>
  );

  const overlays = (
    <>
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

  if (isMobile) {
    return (
      <>
        <div className="flex h-full flex-col overflow-hidden glass-card">
          {mobileFolders || (!emailStore.selectedKontoId && !emailStore.selectedOrdnerId) ? (
            <>
              {/* Without a selected folder the list has nothing to show, so the
                  folder tree is the start pane (it auto-selects the inbox). */}
              {(emailStore.selectedKontoId || emailStore.selectedOrdnerId) &&
                mobileBackButton("Zur Liste", () => setMobileFolders(false))}
              <div className="min-h-0 flex-1 overflow-hidden">
                <FolderTree
                  selectedKontoId={emailStore.selectedKontoId}
                  selectedOrdnerId={emailStore.selectedOrdnerId}
                  onSelectFolder={handleSelectFolderMobile}
                />
              </div>
            </>
          ) : emailStore.selectedEmailId ? (
            <>
              {mobileBackButton("Zur Liste", () => emailStore.selectEmail(null))}
              <div className="min-h-0 flex-1 overflow-hidden">{emailDetail}</div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMobileFolders(true)}
                className="flex min-h-11 items-center gap-2 border-b border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Folder className="w-4 h-4" aria-hidden="true" />
                Ordner und Postfächer
              </button>
              <div className="min-h-0 flex-1 overflow-hidden">{emailList}</div>
            </>
          )}
        </div>
        {overlays}
      </>
    );
  }

  return (
    <>
      <ResizablePanelGroup
        orientation="horizontal"
        autoSaveId="email-inbox-v3"
        className="h-full"
      >
        {/* Left: Folder Tree */}
        <ResizablePanel
          id="folder-tree"
          defaultSize="20%"
          minSize="15%"
          maxSize="30%"
          className="glass-card rounded-l-2xl overflow-hidden"
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
          defaultSize="35%"
          minSize="25%"
        >
          {emailList}
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Email Detail */}
        <ResizablePanel
          id="email-detail"
          defaultSize="45%"
          minSize="30%"
        >
          {emailDetail}
        </ResizablePanel>
      </ResizablePanelGroup>

      {overlays}
    </>
  );
}
