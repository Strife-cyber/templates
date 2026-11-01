import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import type { VisualElement } from '../../core/schema/template'
import { useVisualEditorStore } from '../../store/visualEditorStore'

/** Inline rich-text editing for richText elements (TipTap, sanitized on save). */
export function RichTextEditor(props: { el: VisualElement; onDone: () => void }) {
  const updateProps = useVisualEditorStore((s) => s.updateProps)
  const save = useVisualEditorStore((s) => s.save)

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, code: false, codeBlock: false })],
    content: String(props.el.props?.html ?? ''),
    onUpdate({ editor }) {
      updateProps(props.el.id, { html: editor.getHTML() }, `rich:${props.el.id}`)
    },
    onBlur() {
      save()
      props.onDone()
    },
    editorProps: {
      attributes: {
        class: 'h-full w-full bg-white/70 p-1 outline-none prose-sm',
        style: 'font-size: inherit',
      },
    },
  })

  useEffect(() => {
    editor?.commands.focus('end')
  }, [editor])

  return (
    <div
      className="h-full w-full"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <EditorContent editor={editor} style={{ height: '100%' }} />
    </div>
  )
}
