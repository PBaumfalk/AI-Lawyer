"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import { useImperativeHandle, forwardRef, useCallback } from "react";
import { ComposeToolbar } from "./compose-toolbar";

export interface ComposeEditorRef {
  getHTML: () => string;
  getText: () => string;
  insertHTML: (html: string) => void;
}

interface ComposeEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
}

export const ComposeEditor = forwardRef<ComposeEditorRef, ComposeEditorProps>(
  function ComposeEditor({ initialContent, onChange, placeholder }, ref) {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Link.configure({ openOnClick: false }),
        Image,
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        Placeholder.configure({
          placeholder: placeholder || "Ihre Nachricht...",
        }),
        TextStyle,
        Color,
        Underline,
      ],
      content: initialContent || "",
      onUpdate: ({ editor: ed }) => {
        onChange?.(ed.getHTML());
      },
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3 text-foreground",
        },
        handlePaste: (view, event) => {
          // Handle clipboard image paste (screenshot paste -> base64 inline)
          const items = event.clipboardData?.items;
          if (!items) return false;

          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) continue;

              const reader = new FileReader();
              reader.onload = () => {
                const src = reader.result as string;
                view.dispatch(
                  view.state.tr.replaceSelectionWith(
                    view.state.schema.nodes.image.create({ src })
                  )
                );
              };
              reader.readAsDataURL(file);
              return true;
            }
          }
          return false;
        },
      },
    });

    useImperativeHandle(ref, () => ({
      getHTML: () => editor?.getHTML() || "",
      getText: () => editor?.getText() || "",
      insertHTML: (html: string) => {
        editor?.commands.insertContent(html);
      },
    }));

    const handleEditorReady = useCallback(() => {
      // Editor is ready
    }, []);

    if (!editor) return null;

    return (
      <div className="border border-white/10 dark:border-white/[0.06] rounded-lg overflow-hidden">
        <ComposeToolbar editor={editor} />
        <EditorContent editor={editor} onFocus={handleEditorReady} />
      </div>
    );
  }
);
