import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
} from 'lucide-react';
import { Button } from '../ui/button';

interface EditorButtonsProps {
  editor: Editor | null;
}

export function EditorButtons({ editor }: EditorButtonsProps) {
  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border/40 p-1 bg-muted/20">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${editor.isActive('bold') ? 'bg-accent text-accent-foreground font-bold' : 'text-muted-foreground'}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${editor.isActive('italic') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${editor.isActive('strike') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </Button>

      <div className="h-4 w-px bg-border/60 mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${editor.isActive('heading', { level: 1 }) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${editor.isActive('heading', { level: 2 }) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </Button>

      <div className="h-4 w-px bg-border/60 mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${editor.isActive('bulletList') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <List className="h-3.5 w-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${editor.isActive('orderedList') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered List"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${editor.isActive('blockquote') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      >
        <Quote className="h-3.5 w-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${editor.isActive('codeBlock') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code Block"
      >
        <Code className="h-3.5 w-3.5" />
      </Button>

      <div className="h-4 w-px bg-border/60 mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${editor.isActive('link') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        onClick={setLink}
        title="Insert Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
