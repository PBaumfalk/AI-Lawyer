"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  List,
  ListOrdered,
  Table,
  ImagePlus,
  Palette,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Quote,
  Minus,
} from "lucide-react";
import { useCallback, useState } from "react";

interface ComposeToolbarProps {
  editor: Editor;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
          : "text-muted-foreground hover:bg-white/20 dark:hover:bg-white/[0.06] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function ComposeToolbar({ editor }: ComposeToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const addLink = useCallback(() => {
    const url = window.prompt("URL eingeben:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(() => {
    const url = window.prompt("Bild-URL eingeben:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  const setColor = useCallback(
    (color: string) => {
      editor.chain().focus().setColor(color).run();
      setShowColorPicker(false);
    },
    [editor]
  );

  const colors = [
    "#000000",
    "#374151",
    "#DC2626",
    "#EA580C",
    "#CA8A04",
    "#16A34A",
    "#2563EB",
    "#7C3AED",
    "#DB2777",
  ];

  const iconSize = "w-4 h-4";

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/10 dark:border-white/[0.06] bg-white/30 dark:bg-white/[0.02] flex-wrap">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Fett (Ctrl+B)"
      >
        <Bold className={iconSize} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Kursiv (Ctrl+I)"
      >
        <Italic className={iconSize} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Unterstrichen (Ctrl+U)"
      >
        <Underline className={iconSize} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Durchgestrichen"
      >
        <Strikethrough className={iconSize} />
      </ToolbarButton>

      <div className="w-px h-5 bg-white/10 dark:bg-white/[0.06] mx-1" />

      {/* Links & media */}
      <ToolbarButton
        onClick={addLink}
        active={editor.isActive("link")}
        title="Link"
      >
        <Link2 className={iconSize} />
      </ToolbarButton>

      <ToolbarButton onClick={addImage} title="Bild einfuegen">
        <ImagePlus className={iconSize} />
      </ToolbarButton>

      <div className="w-px h-5 bg-white/10 dark:bg-white/[0.06] mx-1" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Aufzaehlung"
      >
        <List className={iconSize} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Nummerierte Liste"
      >
        <ListOrdered className={iconSize} />
      </ToolbarButton>

      <div className="w-px h-5 bg-white/10 dark:bg-white/[0.06] mx-1" />

      {/* Table */}
      <ToolbarButton onClick={insertTable} title="Tabelle einfuegen">
        <Table className={iconSize} />
      </ToolbarButton>

      <div className="w-px h-5 bg-white/10 dark:bg-white/[0.06] mx-1" />

      {/* Headings */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        active={editor.isActive("heading", { level: 1 })}
        title="Ueberschrift 1"
      >
        <Heading1 className={iconSize} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        active={editor.isActive("heading", { level: 2 })}
        title="Ueberschrift 2"
      >
        <Heading2 className={iconSize} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        active={editor.isActive("heading", { level: 3 })}
        title="Ueberschrift 3"
      >
        <Heading3 className={iconSize} />
      </ToolbarButton>

      <div className="w-px h-5 bg-white/10 dark:bg-white/[0.06] mx-1" />

      {/* Code & quote */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="Code"
      >
        <Code className={iconSize} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Zitat"
      >
        <Quote className={iconSize} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Trennlinie"
      >
        <Minus className={iconSize} />
      </ToolbarButton>

      <div className="w-px h-5 bg-white/10 dark:bg-white/[0.06] mx-1" />

      {/* Color picker */}
      <div className="relative">
        <ToolbarButton
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="Textfarbe"
        >
          <Palette className={iconSize} />
        </ToolbarButton>

        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-white/20 dark:border-white/[0.08] z-50 grid grid-cols-3 gap-1">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setColor(color)}
                className="w-6 h-6 rounded border border-white/20 dark:border-white/[0.1] hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
