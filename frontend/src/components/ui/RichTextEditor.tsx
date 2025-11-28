"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  List,
  ListOrdered,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const colorPresets = [
  "#000000",
  "#333333",
  "#666666",
  "#999999",
  "#FFFFFF",
  "#10B981",
  "#3B82F6",
  "#EF4444",
  "#F97316",
  "#EAB308",
];

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  className = "",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      Color,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-500 underline",
        },
      }),
    ],
    content: content || "",
    immediatelyRender: false, // Fix SSR hydration mismatch
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-invert max-w-none focus:outline-none min-h-[100px] px-3 py-2",
      },
    },
  });

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl || "https://");

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className={`border border-gray-700 rounded-lg overflow-hidden bg-gray-800 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-700 bg-gray-900">
        {/* Text formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive("bold") ? "bg-gray-700 text-yellow-500" : "text-gray-400"
          }`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive("italic") ? "bg-gray-700 text-yellow-500" : "text-gray-400"
          }`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive("underline") ? "bg-gray-700 text-yellow-500" : "text-gray-400"
          }`}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive("strike") ? "bg-gray-700 text-yellow-500" : "text-gray-400"
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive({ textAlign: "left" }) ? "bg-gray-700 text-yellow-500" : "text-gray-400"
          }`}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive({ textAlign: "center" }) ? "bg-gray-700 text-yellow-500" : "text-gray-400"
          }`}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive({ textAlign: "right" }) ? "bg-gray-700 text-yellow-500" : "text-gray-400"
          }`}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive("bulletList") ? "bg-gray-700 text-yellow-500" : "text-gray-400"
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive("orderedList") ? "bg-gray-700 text-yellow-500" : "text-gray-400"
          }`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Link */}
        <button
          type="button"
          onClick={setLink}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive("link") ? "bg-gray-700 text-yellow-500" : "text-gray-400"
          }`}
          title="Add Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Color picker */}
        <div className="flex items-center gap-1">
          {colorPresets.slice(0, 5).map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => editor.chain().focus().setColor(color).run()}
              className="w-5 h-5 rounded border border-gray-600 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={`Text color: ${color}`}
            />
          ))}
          <input
            type="color"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
            title="Custom color"
          />
        </div>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="text-white [&_.ProseMirror]:outline-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:my-1"
      />
    </div>
  );
}

export default RichTextEditor;
