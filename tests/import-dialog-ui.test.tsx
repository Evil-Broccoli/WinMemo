import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppSidebar } from '../src/renderer/components/AppSidebar'
import {
  DeleteNoteDialog,
  WorkspaceShell
} from '../src/renderer/components/WorkspaceShell'
import type { Note, NoteSummary } from '../src/shared/notes'

test('renders an import trigger in the sidebar', () => {
  const html = renderToStaticMarkup(
    createElement(AppSidebar, {
      notes: [],
      noteCount: 0,
      isLoading: false,
      loadErrorMessage: undefined,
      statusMessage: 'Stored on this device',
      searchQuery: '',
      selectedNoteId: undefined,
      onCreateNote: () => undefined,
      onImportNotes: () => undefined,
      onOpenQuickNote: () => undefined,
      onRetryLoadNotes: () => undefined,
      onSearchQueryChange: () => undefined,
      onSelectNote: () => undefined
    })
  )

  assert.match(html, /<button[^>]*type="button"[^>]*>/)
  assert.match(html, />Import</)
  assert.match(html, /class="[^"]*sidebar-import-button/)
})

test('renders sidebar search state with matching count and clear action', () => {
  const notes = [
    createNoteSummary('note-2', 'Shopping list', 'Coffee beans and tea')
  ]
  const html = renderToStaticMarkup(
    createElement(AppSidebar, {
      notes,
      noteCount: notes.length,
      isLoading: false,
      loadErrorMessage: undefined,
      statusMessage: 'Stored on this device',
      searchQuery: 'tea',
      selectedNoteId: 'note-2',
      onCreateNote: () => undefined,
      onImportNotes: () => undefined,
      onOpenQuickNote: () => undefined,
      onRetryLoadNotes: () => undefined,
      onSearchQueryChange: () => undefined,
      onSelectNote: () => undefined
    })
  )

  assert.match(html, />Search results</)
  assert.match(html, /aria-label="1 matching note"/)
  assert.match(html, /value="tea"/)
  assert.match(html, /aria-label="Clear search"/)
  assert.match(html, />Shopping list</)
})

test('renders sidebar empty search results distinctly from an empty library', () => {
  const html = renderToStaticMarkup(
    createElement(AppSidebar, {
      notes: [],
      noteCount: 0,
      isLoading: false,
      loadErrorMessage: undefined,
      statusMessage: 'Stored on this device',
      searchQuery: 'missing',
      selectedNoteId: undefined,
      onCreateNote: () => undefined,
      onImportNotes: () => undefined,
      onOpenQuickNote: () => undefined,
      onRetryLoadNotes: () => undefined,
      onSearchQueryChange: () => undefined,
      onSelectNote: () => undefined
    })
  )

  assert.match(html, />No notes found</)
  assert.match(html, />Try a different search term\.</)
  assert.doesNotMatch(html, />No notes yet</)
})

test('renders sidebar load failures with retry feedback', () => {
  const html = renderToStaticMarkup(
    createElement(AppSidebar, {
      notes: [],
      noteCount: 0,
      isLoading: false,
      loadErrorMessage: 'Desktop note storage is unavailable.',
      statusMessage: 'Desktop note storage is unavailable.',
      searchQuery: '',
      selectedNoteId: undefined,
      onCreateNote: () => undefined,
      onImportNotes: () => undefined,
      onOpenQuickNote: () => undefined,
      onRetryLoadNotes: () => undefined,
      onSearchQueryChange: () => undefined,
      onSelectNote: () => undefined
    })
  )

  assert.match(html, />Notes unavailable</)
  assert.match(html, /Desktop note storage is unavailable\./)
  assert.match(html, />Retry</)
  assert.match(html, /status-dot-danger/)
})

test('renders an export trigger for the selected note workspace', () => {
  const note: Note = {
    id: 'note-1',
    title: 'Meeting notes',
    contentMarkdown: '# Meeting notes',
    previewText: 'Meeting notes',
    createdAt: '2026-06-04T08:00:00.000Z',
    updatedAt: '2026-06-04T08:00:00.000Z',
    pinned: false,
    sourceType: 'note'
  }
  const html = renderToStaticMarkup(
    createElement(WorkspaceShell, {
      isLoading: false,
      loadErrorMessage: undefined,
      selectedNote: note,
      statusMessage: 'Stored on this device',
      onCreateNote: () => undefined,
      onContentChange: () => undefined,
      onDeleteNote: () => undefined,
      onExportNote: () => undefined
    })
  )

  assert.match(html, /aria-label="Export note"/)
  assert.match(html, /title="Export note"/)
})

test('renders workspace loading state without creation prompts', () => {
  const html = renderToStaticMarkup(
    createElement(WorkspaceShell, {
      isLoading: true,
      loadErrorMessage: undefined,
      selectedNote: undefined,
      statusMessage: 'Loading notes...',
      onCreateNote: () => undefined,
      onContentChange: () => undefined,
      onDeleteNote: () => undefined,
      onExportNote: () => undefined
    })
  )

  assert.match(html, />Loading notes</)
  assert.match(html, />Reading saved notes from this device\.</)
  assert.doesNotMatch(html, />Create a note</)
})

test('renders workspace load failures without offering unavailable actions', () => {
  const html = renderToStaticMarkup(
    createElement(WorkspaceShell, {
      isLoading: false,
      loadErrorMessage: 'Desktop note storage is unavailable.',
      selectedNote: undefined,
      statusMessage: 'Desktop note storage is unavailable.',
      onCreateNote: () => undefined,
      onContentChange: () => undefined,
      onDeleteNote: () => undefined,
      onExportNote: () => undefined
    })
  )

  assert.match(html, />Notes unavailable</)
  assert.match(html, /Desktop note storage is unavailable\./)
  assert.doesNotMatch(html, />Create a note</)
})

test('renders delete confirmation copy and destructive action distinctly', () => {
  const html = renderToStaticMarkup(
    createElement(DeleteNoteDialog, {
      noteTitle: 'Meeting notes',
      onCancel: () => undefined,
      onConfirm: () => undefined
    })
  )

  assert.match(html, /role="alertdialog"/)
  assert.match(html, />Delete note\?</)
  assert.match(html, /This removes &quot;Meeting notes&quot; from this device/)
  assert.match(html, /class="[^"]*dialog-button-danger/)
})

function createNoteSummary(
  id: string,
  title: string,
  previewText: string
): NoteSummary {
  return {
    id,
    title,
    previewText,
    updatedAt: '2026-06-04T08:00:00.000Z',
    pinned: false,
    sourceType: 'note'
  }
}
