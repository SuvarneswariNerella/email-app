import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorButtons } from './editor-buttons';
import { useEffect } from 'react';

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function RichEditor({ content, onChange, placeholder = 'Write your email...', autoFocus = false }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline hover:text-primary/80',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none p-3 focus:outline-none min-h-[160px] text-sm text-foreground',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className="flex flex-col border border-input rounded-md overflow-hidden bg-background focus-within:ring-1 focus-within:ring-ring">
      <EditorButtons editor={editor} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto max-h-[350px] style-scrollbar" />
    </div>
  );
}
