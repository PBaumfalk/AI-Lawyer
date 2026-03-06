"use client";

import { useState, useCallback } from "react";
import { GripVertical } from "lucide-react";

interface PdfPageThumbnailsProps {
  pageCount: number;
  onReorder: (order: number[]) => void;
  selectedPages?: Set<number>;
  onSelectPage?: (page: number) => void;
}

/**
 * Drag-and-drop page thumbnail grid for PDF reorder/split preview.
 * Uses native HTML drag-and-drop (no external dependencies).
 */
export function PdfPageThumbnails({
  pageCount,
  onReorder,
  selectedPages,
  onSelectPage,
}: PdfPageThumbnailsProps) {
  // order[i] = original page number at position i
  const [order, setOrder] = useState<number[]>(() =>
    Array.from({ length: pageCount }, (_, i) => i + 1)
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
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
    (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault();
      setOverIndex(null);
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragIndex(null);
        return;
      }
      const newOrder = [...order];
      const [moved] = newOrder.splice(dragIndex, 1);
      newOrder.splice(dropIndex, 0, moved);
      setOrder(newOrder);
      onReorder(newOrder);
      setDragIndex(null);
    },
    [dragIndex, order, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const handleClick = useCallback(
    (page: number) => {
      if (onSelectPage) {
        onSelectPage(page);
      }
    },
    [onSelectPage]
  );

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
      {order.map((page, index) => {
        const isSelected = selectedPages?.has(page);
        const isDragging = dragIndex === index;
        const isOver = overIndex === index;

        return (
          <div
            key={`page-${page}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => handleClick(page)}
            className={`
              relative flex flex-col items-center justify-center
              w-20 h-[100px] rounded-md border-2 cursor-grab
              select-none transition-all duration-150
              ${isDragging ? "opacity-40 scale-95" : ""}
              ${isOver ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" : ""}
              ${isSelected
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-300 dark:ring-blue-700"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
              }
            `}
          >
            <GripVertical className="absolute top-1 right-1 w-3 h-3 text-slate-400" />
            <span className="text-lg font-semibold text-slate-600 dark:text-slate-300">
              {page}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">S. {page}</span>
          </div>
        );
      })}
    </div>
  );
}
