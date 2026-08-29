import { forwardRef, useImperativeHandle, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { markdownEditorExtensions } from '../lib/editorTheme'

interface EditorProps {
  value: string
  onChange: (value: string) => void
}

export interface EditorHandle {
  insertAtCursor: (text: string) => void
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ value, onChange }, ref) {
  const cmRef = useRef<ReactCodeMirrorRef>(null)

  useImperativeHandle(ref, () => ({
    insertAtCursor(text: string) {
      const view = cmRef.current?.view
      if (!view) return
      const { from, to } = view.state.selection.main
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      })
      view.focus()
    },
  }))

  return (
    <CodeMirror
      ref={cmRef}
      value={value}
      height="100%"
      theme="none"
      placeholder="Mulai menulis…"
      extensions={[markdown(), EditorView.lineWrapping, ...markdownEditorExtensions()]}
      onChange={onChange}
      className="h-full"
    />
  )
})

export default Editor
