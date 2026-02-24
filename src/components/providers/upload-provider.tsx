"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useSocket } from "@/components/socket-provider";

export type UploadStatus = "uploading" | "ocr-queued" | "done" | "error";

export interface UploadItem {
  id: string;
  file: File;
  akteId: string;
  progress: number;
  status: UploadStatus;
  error?: string;
  dokumentId?: string;
}

interface UploadContextValue {
  uploads: UploadItem[];
  addFiles: (akteId: string, files: File[]) => void;
  clearCompleted: () => void;
  isUploading: boolean;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return ctx;
}

/**
 * Generate a unique ID for upload tracking.
 */
function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Upload a single file using XMLHttpRequest for progress tracking.
 */
function uploadFileWithProgress(
  akteId: string,
  file: File,
  onProgress: (percent: number) => void,
  onComplete: (response: any) => void,
  onError: (error: string) => void
): XMLHttpRequest {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append("file", file);

  xhr.upload.addEventListener("progress", (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      onProgress(percent);
    }
  });

  xhr.addEventListener("load", () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const response = JSON.parse(xhr.responseText);
        onComplete(response);
      } catch {
        onComplete({});
      }
    } else {
      try {
        const errorData = JSON.parse(xhr.responseText);
        onError(errorData.error || `Upload fehlgeschlagen (${xhr.status})`);
      } catch {
        onError(`Upload fehlgeschlagen (${xhr.status})`);
      }
    }
  });

  xhr.addEventListener("error", () => {
    onError("Netzwerkfehler beim Upload");
  });

  xhr.addEventListener("abort", () => {
    onError("Upload abgebrochen");
  });

  xhr.open("POST", `/api/akten/${akteId}/dokumente`);
  xhr.send(formData);

  return xhr;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const { socket } = useSocket();

  // Listen for Socket.IO OCR completion events
  useEffect(() => {
    if (!socket) return;

    const handleOcrComplete = (data: {
      dokumentId: string;
      status: string;
    }) => {
      setUploads((prev) =>
        prev.map((item) =>
          item.dokumentId === data.dokumentId
            ? { ...item, status: "done" as UploadStatus }
            : item
        )
      );
    };

    socket.on("document:ocr-complete", handleOcrComplete);
    return () => {
      socket.off("document:ocr-complete", handleOcrComplete);
    };
  }, [socket]);

  const addFiles = useCallback((akteId: string, files: File[]) => {
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      id: generateUploadId(),
      file,
      akteId,
      progress: 0,
      status: "uploading" as UploadStatus,
    }));

    setUploads((prev) => [...prev, ...newItems]);

    // Start uploads for each file
    for (const item of newItems) {
      uploadFileWithProgress(
        akteId,
        item.file,
        // Progress callback
        (percent) => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id ? { ...u, progress: percent } : u
            )
          );
        },
        // Complete callback
        (response) => {
          const dokumentId = response.uploaded?.[0]?.id;
          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id
                ? {
                    ...u,
                    progress: 100,
                    status: "ocr-queued" as UploadStatus,
                    dokumentId,
                  }
                : u
            )
          );
        },
        // Error callback
        (error) => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id
                ? { ...u, status: "error" as UploadStatus, error }
                : u
            )
          );
        }
      );
    }
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads((prev) =>
      prev.filter((u) => u.status !== "done" && u.status !== "error")
    );
  }, []);

  const isUploading = uploads.some((u) => u.status === "uploading");

  return (
    <UploadContext.Provider
      value={{ uploads, addFiles, clearCompleted, isUploading }}
    >
      {children}
    </UploadContext.Provider>
  );
}
