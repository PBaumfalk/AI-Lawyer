"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "core-js/proposals/promise-with-resolvers";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Download,
  Printer,
  Search,
  X,
  Columns2,
  Loader2,
  RotateCcw,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PdfViewerProps {
  url: string;
  className?: string;
}

/**
 * In-browser PDF viewer with page navigation, zoom, thumbnails,
 * text selection, search, print, fullscreen, and download.
 */
export function PdfViewer({ url, className }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [pageInput, setPageInput] = useState("1");

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle document load success
  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setLoading(false);
      setError(false);
    },
    []
  );

  // Handle document load error
  const onDocumentLoadError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  // Page navigation
  const goToPage = useCallback(
    (page: number) => {
      const target = Math.max(1, Math.min(page, numPages));
      setPageNumber(target);
      setPageInput(String(target));
    },
    [numPages]
  );

  const prevPage = useCallback(() => goToPage(pageNumber - 1), [goToPage, pageNumber]);
  const nextPage = useCallback(() => goToPage(pageNumber + 1), [goToPage, pageNumber]);
  const firstPage = useCallback(() => goToPage(1), [goToPage]);
  const lastPage = useCallback(() => goToPage(numPages), [goToPage, numPages]);

  // Handle page input change
  const handlePageInputSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const parsed = parseInt(pageInput, 10);
      if (!isNaN(parsed)) {
        goToPage(parsed);
      }
    },
    [pageInput, goToPage]
  );

  // Zoom controls (50% - 300%)
  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(3.0, Math.round((s + 0.25) * 100) / 100));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(0.5, Math.round((s - 0.25) * 100) / 100));
  }, []);

  const fitToWidth = useCallback(() => {
    setScale(1.0);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Download
  const handleDownload = useCallback(() => {
    window.open(url, "_blank");
  }, [url]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only when this viewer is focused (or fullscreen)
      if (
        !containerRef.current?.contains(document.activeElement) &&
        !isFullscreen
      )
        return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prevPage();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextPage();
      } else if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSearch((s) => !s);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [prevPage, nextPage, isFullscreen]);

  // Retry loading
  const handleRetry = useCallback(() => {
    setError(false);
    setLoading(true);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-slate-100 dark:bg-slate-900 ${className ?? ""}`}
      tabIndex={0}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        {/* Thumbnail toggle */}
        <Button
          size="sm"
          variant={showThumbnails ? "secondary" : "ghost"}
          onClick={() => setShowThumbnails((s) => !s)}
          title="Seitenleiste"
          className="h-8 w-8 p-0"
        >
          <Columns2 className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Page navigation */}
        <Button
          size="sm"
          variant="ghost"
          onClick={firstPage}
          disabled={pageNumber <= 1}
          title="Erste Seite"
          className="h-8 w-8 p-0"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={prevPage}
          disabled={pageNumber <= 1}
          title="Vorherige Seite"
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <form
          onSubmit={handlePageInputSubmit}
          className="flex items-center gap-1"
        >
          <Input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={handlePageInputSubmit}
            className="w-12 h-7 text-center text-xs px-1"
          />
          <span className="text-xs text-slate-500 whitespace-nowrap">
            von {numPages}
          </span>
        </form>

        <Button
          size="sm"
          variant="ghost"
          onClick={nextPage}
          disabled={pageNumber >= numPages}
          title="Naechste Seite"
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={lastPage}
          disabled={pageNumber >= numPages}
          title="Letzte Seite"
          className="h-8 w-8 p-0"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Zoom controls */}
        <Button
          size="sm"
          variant="ghost"
          onClick={zoomOut}
          disabled={scale <= 0.5}
          title="Verkleinern"
          className="h-8 w-8 p-0"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-slate-600 dark:text-slate-300 w-12 text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={zoomIn}
          disabled={scale >= 3.0}
          title="Vergroessern"
          className="h-8 w-8 p-0"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={fitToWidth}
          title="An Breite anpassen"
          className="h-8 px-2 text-xs"
        >
          Breite
        </Button>

        <div className="flex-1" />

        {/* Search toggle */}
        <Button
          size="sm"
          variant={showSearch ? "secondary" : "ghost"}
          onClick={() => setShowSearch((s) => !s)}
          title="Suchen (Ctrl+F)"
          className="h-8 w-8 p-0"
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Print */}
        <Button
          size="sm"
          variant="ghost"
          onClick={handlePrint}
          title="Drucken"
          className="h-8 w-8 p-0"
        >
          <Printer className="w-4 h-4" />
        </Button>

        {/* Download */}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDownload}
          title="Herunterladen"
          className="h-8 w-8 p-0"
        >
          <Download className="w-4 h-4" />
        </Button>

        {/* Fullscreen */}
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Vollbild beenden" : "Vollbild"}
          className="h-8 w-8 p-0"
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 flex-shrink-0">
          <Search className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Im PDF suchen..."
            className="h-7 text-sm flex-1"
            autoFocus
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowSearch(false);
              setSearchText("");
            }}
            className="h-7 w-7 p-0"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
          {searchText && (
            <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
              Textsuche via Browser (Ctrl+F)
            </span>
          )}
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Thumbnail sidebar */}
        {showThumbnails && numPages > 0 && (
          <div className="w-32 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 overflow-y-auto p-2 space-y-2">
            {Array.from({ length: numPages }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`w-full rounded-md overflow-hidden border-2 transition-colors ${
                    page === pageNumber
                      ? "border-blue-500 dark:border-blue-400"
                      : "border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <Document file={url} loading={null} error={null}>
                    <Page
                      pageNumber={page}
                      width={100}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                  <div className="text-[10px] text-center py-0.5 text-slate-500">
                    {page}
                  </div>
                </button>
              )
            )}
          </div>
        )}

        {/* PDF document */}
        <div
          ref={contentRef}
          className="flex-1 overflow-auto flex justify-center p-4"
        >
          {error ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <p className="text-sm">PDF konnte nicht geladen werden</p>
              <Button size="sm" variant="outline" onClick={handleRetry}>
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Erneut versuchen
              </Button>
            </div>
          ) : (
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 p-12">
                  <p className="text-sm">PDF konnte nicht geladen werden</p>
                  <Button size="sm" variant="outline" onClick={handleRetry}>
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    Erneut versuchen
                  </Button>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                }
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
