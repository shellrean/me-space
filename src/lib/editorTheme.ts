import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const MONO_STACK = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

export const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#0b0c10',
      color: '#d4d4d8',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#22d3ee',
      fontFamily: MONO_STACK,
      fontSize: '14px',
      padding: '1.5rem 1.75rem',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#22d3ee',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(167, 139, 250, 0.22) !important',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.035)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: '#9ca3af',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: '#3f3f46',
      border: 'none',
      paddingLeft: '0.5rem',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 14px 0 0',
    },
    '.cm-foldGutter': {
      color: '#3f3f46',
    },
    '.cm-scroller': {
      fontFamily: MONO_STACK,
      lineHeight: '1.7',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(34, 211, 238, 0.15)',
      outline: 'none',
      borderRadius: '3px',
    },
    '.cm-placeholder': {
      color: '#52525b',
      fontStyle: 'italic',
    },
    '.cm-panels': {
      backgroundColor: '#111318',
      color: '#d4d4d8',
    },
    '.cm-panels-top': {
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    },
    '.cm-panels-bottom': {
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    },
    '.cm-panel.cm-search': {
      padding: '8px 32px 8px 10px',
      fontFamily: MONO_STACK,
      fontSize: '12px',
    },
    '.cm-panel.cm-search label': {
      color: '#a1a1aa',
    },
    '.cm-panel.cm-search input[type=checkbox]': {
      accentColor: '#22d3ee',
      verticalAlign: 'middle',
    },
    '.cm-panel.cm-search .cm-textfield': {
      backgroundColor: '#0b0c10',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
      color: '#f4f4f5',
      padding: '3px 8px',
      fontFamily: MONO_STACK,
      fontSize: '12px',
      outline: 'none',
    },
    '.cm-panel.cm-search .cm-textfield:focus': {
      borderColor: '#22d3ee',
    },
    '.cm-panel.cm-search .cm-button': {
      backgroundImage: 'none',
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
      color: '#d4d4d8',
      padding: '3px 8px',
      fontSize: '12px',
      cursor: 'pointer',
    },
    '.cm-panel.cm-search .cm-button:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      color: '#67e8f9',
    },
    '.cm-panel.cm-search [name=close]': {
      color: '#71717a',
      fontSize: '16px',
      lineHeight: '1',
      cursor: 'pointer',
    },
    '.cm-panel.cm-search [name=close]:hover': {
      color: '#f87171',
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(34, 211, 238, 0.35)',
      borderRadius: '2px',
    },
    '.cm-searchMatch-selected': {
      backgroundColor: 'rgba(167, 139, 250, 0.55)',
      borderRadius: '2px',
    },
  },
  { dark: true },
)

export const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.5em', color: '#f4f4f5' },
  { tag: tags.heading2, fontWeight: '700', fontSize: '1.3em', color: '#f4f4f5' },
  { tag: tags.heading3, fontWeight: '600', fontSize: '1.15em', color: '#e4e4e7' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: '#e4e4e7' },
  { tag: tags.strong, fontWeight: '700', color: '#f4f4f5' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#e4e4e7' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#71717a' },
  { tag: tags.link, color: '#22d3ee' },
  { tag: tags.url, color: '#67e8f9', textDecoration: 'underline' },
  { tag: tags.monospace, color: '#c4b5fd' },
  { tag: tags.quote, color: '#a1a1aa', fontStyle: 'italic' },
  { tag: tags.list, color: '#a78bfa' },
  { tag: tags.contentSeparator, color: '#52525b' },
  { tag: tags.processingInstruction, color: '#52525b' },
  { tag: tags.meta, color: '#52525b' },
  { tag: tags.comment, color: '#71717a', fontStyle: 'italic' },
])

export function markdownEditorExtensions() {
  return [editorTheme, syntaxHighlighting(markdownHighlightStyle)]
}
