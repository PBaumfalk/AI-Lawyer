"use client";

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { FolderTree } from "@/components/email/folder-tree";
import { EmailList } from "@/components/email/email-list";
import { EmailDetail } from "@/components/email/email-detail";
import { useEmailStore } from "@/hooks/use-email-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

/**
 * Three-pane resizable inbox layout.
 * Left: folder tree. Center: email list. Right: email detail.
 * Panel sizes persist in localStorage via autoSaveId.
 */
export function InboxLayout() {
  const emailStore = useEmailStore();

  // Register Gmail-style keyboard shortcuts
  useKeyboardShortcuts(emailStore);

  return (
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
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
