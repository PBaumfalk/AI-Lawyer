"use client";

import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { Save, Eye, Tag, Info } from "lucide-react";
import { toast } from "sonner";
import { renderSignature, type SignatureUserData } from "@/lib/email/signature";

const PLACEHOLDERS = [
  { key: "{{name}}", label: "Name" },
  { key: "{{titel}}", label: "Titel/Position" },
  { key: "{{mobil}}", label: "Mobil" },
  { key: "{{durchwahl}}", label: "Durchwahl" },
  { key: "{{email}}", label: "E-Mail" },
];

const SAMPLE_USER: SignatureUserData = {
  name: "Dr. Max Mustermann",
  titel: "Rechtsanwalt",
  mobil: "+49 170 1234567",
  durchwahl: "+49 30 1234567-12",
  email: "m.mustermann@kanzlei.de",
};

interface SignatureEditorProps {
  kontoId?: string;
}

export function SignatureEditor({ kontoId }: SignatureEditorProps) {
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [initialLoaded, setInitialLoaded] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Image,
      Link.configure({ openOnClick: false }),
      Underline,
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3 text-foreground",
      },
    },
  });

  // Load existing signature template
  useEffect(() => {
    if (!kontoId || initialLoaded) return;

    fetch(`/api/email-konten/${kontoId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.signaturVorlage && editor) {
          editor.commands.setContent(data.signaturVorlage);
        }
        setInitialLoaded(true);
      })
      .catch(() => {});
  }, [kontoId, editor, initialLoaded]);

  const insertPlaceholder = (placeholder: string) => {
    editor?.chain().focus().insertContent(placeholder).run();
  };

  const handlePreview = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const rendered = renderSignature(html, SAMPLE_USER);
    setPreviewHtml(rendered);
    setShowPreview(true);
  };

  const handleSave = async () => {
    if (!editor || !kontoId) {
      toast.error("Kein Postfach ausgewaehlt");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/email-konten/${kontoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signaturVorlage: editor.getHTML(),
        }),
      });

      if (res.ok) {
        toast.success("Signatur-Vorlage gespeichert");
      } else {
        toast.error("Fehler beim Speichern der Signatur");
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Placeholders */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-muted-foreground" />
          Platzhalter
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => insertPlaceholder(p.key)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-xs rounded-full border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors cursor-pointer"
            >
              <code className="text-[10px]">{p.key}</code>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TipTap editor */}
      <div className="border border-white/20 dark:border-white/[0.08] rounded-lg overflow-hidden">
        {editor && (
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/10 dark:border-white/[0.06] bg-white/30 dark:bg-white/[0.02]">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded text-sm ${
                editor.isActive("bold")
                  ? "bg-brand-100 dark:bg-brand-900/30 text-brand-600"
                  : "text-muted-foreground hover:bg-white/20"
              }`}
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded text-sm ${
                editor.isActive("italic")
                  ? "bg-brand-100 dark:bg-brand-900/30 text-brand-600"
                  : "text-muted-foreground hover:bg-white/20"
              }`}
            >
              <em>I</em>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded text-sm ${
                editor.isActive("underline")
                  ? "bg-brand-100 dark:bg-brand-900/30 text-brand-600"
                  : "text-muted-foreground hover:bg-white/20"
              }`}
            >
              <u>U</u>
            </button>
            <button
              type="button"
              onClick={() => {
                const url = window.prompt("URL eingeben:");
                if (url) editor.chain().focus().setLink({ href: url }).run();
              }}
              className="p-1.5 rounded text-sm text-muted-foreground hover:bg-white/20"
            >
              Link
            </button>
          </div>
        )}
        <EditorContent editor={editor} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePreview}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/20 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
        >
          <Eye className="w-4 h-4" />
          Vorschau
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !kontoId}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? "Wird gespeichert..." : "Signatur speichern"}
        </button>
      </div>

      {/* Info text */}
      <div className="flex items-start gap-2 px-3 py-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          Benutzer fuellen ihre persoenlichen Werte (Name, Titel, Telefon) in
          ihrem Profil aus. Die Platzhalter in der Vorlage werden automatisch
          durch die jeweiligen Benutzerdaten ersetzt.
        </p>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-white/20 dark:border-white/[0.08] w-full max-w-lg p-6">
            <h3 className="text-lg font-heading text-foreground mb-4">
              Signatur-Vorschau
            </h3>
            <div className="p-4 border border-white/10 dark:border-white/[0.06] rounded-lg bg-white/50 dark:bg-white/[0.02]">
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Beispieldaten: Dr. Max Mustermann, Rechtsanwalt
            </p>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Schliessen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
