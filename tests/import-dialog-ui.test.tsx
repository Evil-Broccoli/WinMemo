import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppSidebar } from '../src/renderer/components/AppSidebar'
import { WorkspaceShell } from '../src/renderer/components/WorkspaceShell'
import type { Note } from '../src/shared/notes'

test('renders an import trigger in the sidebar', () => {
  const html = renderToStaticMarkup(
    createElement(AppSidebar, {
      notes: [],
      noteCount: 0,
      isLoading: false,
      statusMessage: 'Stored on this device',
      searchQuery: '',
      selectedNoteId: undefined,
      onCreateNote: () => undefined,
      onImportNotes: () => undefined,
      onOpenQuickNote: () => undefined,
      onSearchQueryChange: () => undefined,
      onSelectNote: () => undefined
    })
  )

  assert.match(html, /<button[^>]*type="button"[^>]*>/)
  assert.match(html, />Import</)
  assert.match(html, /class="[^"]*sidebar-import-button/)
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
