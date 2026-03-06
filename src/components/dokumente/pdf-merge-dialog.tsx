"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GripVertical, X, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

interface MergeDocument {
  id: string;
  name: string;
  mimeType: string;
}

interface PdfMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  akteId: string;
  documents: MergeDocument[];
  onComplete: () => void;
}

export function PdfMergeDialog({
  open,
  onOpenChange,
  akteId,
  documents,
  onComplete,
}: PdfMergeDialogProps) {
  const pdfDocuments = documents.filter(
    (d) => d.mimeType === "application/pdf"
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    pdfDocuments.map((d) => d.id)
  );
  const [loading, setLoading] = useState(false);
  const [outputName, setOutputName] = useState(() => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    return `Zusammengefuehrt_${dateStr}.pdf`;
  });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const selectedDocs = selectedIds
    .map((id) => pdfDocuments.find((d) => d.id === id))
    .filter(Boolean) as MergeDocument[];

  const handleRemove = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverIndex(index);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      setOverIndex(null);
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragIndex(null);
        return;
      }
      setSelectedIds((prev) => {
        const newIds = [...prev];
        const [moved] = newIds.splice(dragIndex, 1);
        newIds.splice(dropIndex, 0, moved);
        return newIds;
      });
      setDragIndex(null);
    },
    [dragIndex]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const handleMerge = async () => {
    if (selectedIds.length < 2) {
      toast.error("Mindestens 2 PDF-Dokumente erforderlich");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/dokumente/pdf-tools/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dokumentIds: selectedIds,
          akteId,
          name: outputName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Zusammenfuehren fehlgeschlagen");
      }

      const data = await res.json();
      toast.success(`PDFs zusammengefuehrt: ${data.name}`);
      onComplete();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PDFs zusammenfuehren</DialogTitle>
        </DialogHeader>

        {pdfDocuments.length < 2 ? (
          <div className="flex items-start gap-2 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Mindestens 2 PDF-Dokumente erforderlich. Aktuell{" "}
              {pdfDocuments.length === 0
                ? "keine PDFs"
                : "nur 1 PDF"}{" "}
              in dieser Akte vorhanden.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm font-medium">
                Reihenfolge (per Drag & Drop aenderbar)
              </Label>
              <div className="mt-2 space-y-1.5">
                {selectedDocs.map((doc, index) => {
                  const isDragging = dragIndex === index;
                  const isOver = overIndex === index;
                  return (
                    <div
                      key={doc.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-md border cursor-grab
                        transition-all duration-150
                        ${isDragging ? "opacity-40 scale-95" : ""}
                        ${isOver
                          ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        }
                      `}
                    >
                      <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-xs font-mono text-slate-400 w-5">
                        {index + 1}.
                      </span>
                      <span className="text-sm flex-1 truncate">
                        {doc.name}
                      </span>
                      <button
                        onClick={() => handleRemove(doc.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
              {selectedIds.length < 2 && (
                <p className="text-xs text-rose-500 mt-1">
                  Mindestens 2 Dokumente muessen ausgewaehlt sein
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium">Dateiname</Label>
              <Input
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className="mt-1"
                placeholder="Zusammengefuehrt.pdf"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                onClick={handleMerge}
                disabled={loading || selectedIds.length < 2}
              >
                {loading && (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                )}
                Zusammenfuehren
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
