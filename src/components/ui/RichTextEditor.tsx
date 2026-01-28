
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import { Toggle } from '@/components/ui/toggle';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Undo, Redo } from 'lucide-react';
import { useEffect } from 'react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    editable?: boolean;
}

export function RichTextEditor({ value, onChange, editable = true }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                }
            }),
            Link.configure({
                openOnClick: false,
            }),
            Markdown.configure({
                html: true,                  // Allow HTML input/output
                transformPastedText: true,  // Allow pasting markdown
                transformCopiedText: true,  // Copy as markdown
                linkify: true,
            }),
        ],
        content: value,
        editable: editable,
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[120px] px-3 py-2',
            },
        },
        onUpdate: ({ editor }) => {
            const markdown = editor.storage.markdown.getMarkdown();
            onChange(markdown);
        },
    });

    // Handle dynamic editable prop usage
    useEffect(() => {
        if (editor && editor.isEditable !== editable) {
            editor.setEditable(editable);
        }
    }, [editable, editor]);


    if (!editor) {
        return null;
    }

    // If not editable (View Mode equivalent), just show content
    // But wait, the parent handles view/edit toggling.
    // If we want a seamless "always nice" view that becomes editable, Tiptap is great for that too.
    // But for now, we'll implement the Toolbar only when editable.

    return (
        <div className={`border rounded-md ${editable ? 'border-input bg-background' : 'border-transparent'}`}>
            {editable && (
                <div className="flex flex-wrap gap-1 border-b border-border bg-muted/20 p-1">
                    <Toggle
                        size="sm"
                        pressed={editor.isActive('bold')}
                        onPressedChange={() => editor.chain().focus().toggleBold().run()}
                    >
                        <Bold className="h-4 w-4" />
                    </Toggle>
                    <Toggle
                        size="sm"
                        pressed={editor.isActive('italic')}
                        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                    >
                        <Italic className="h-4 w-4" />
                    </Toggle>
                    <div className="w-px h-6 bg-border mx-1 my-auto" />
                    <Toggle
                        size="sm"
                        pressed={editor.isActive('heading', { level: 2 })}
                        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    >
                        <Heading1 className="h-4 w-4" />
                    </Toggle>
                    <Toggle
                        size="sm"
                        pressed={editor.isActive('heading', { level: 3 })}
                        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    >
                        <Heading2 className="h-4 w-4" />
                    </Toggle>
                    <div className="w-px h-6 bg-border mx-1 my-auto" />
                    <Toggle
                        size="sm"
                        pressed={editor.isActive('bulletList')}
                        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                    >
                        <List className="h-4 w-4" />
                    </Toggle>
                    <Toggle
                        size="sm"
                        pressed={editor.isActive('orderedList')}
                        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                    >
                        <ListOrdered className="h-4 w-4" />
                    </Toggle>
                    <Toggle
                        size="sm"
                        pressed={editor.isActive('blockquote')}
                        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                    >
                        <Quote className="h-4 w-4" />
                    </Toggle>
                    <div className="ml-auto flex gap-1">
                        <Toggle size="sm" onPressedChange={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
                            <Undo className="h-4 w-4" />
                        </Toggle>
                        <Toggle size="sm" onPressedChange={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
                            <Redo className="h-4 w-4" />
                        </Toggle>
                    </div>
                </div>
            )}
            <EditorContent editor={editor} />
        </div>
    );
}
