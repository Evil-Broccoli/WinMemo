import React from 'react'
import type { NoteId, NoteSummary } from '@shared/notes'
import { APP_NAME } from '../../shared/constants'
import { formatNoteUpdatedAt } from '../notes/note-list'
import { ImportIcon, NoteIcon, PlusIcon, SearchIcon } from './icons'

interface AppSidebarProps {
  readonly notes: readonly NoteSummary[]
  readonly noteCount: number
  readonly isLoading: boolean
  readonly statusMessage: string
  readonly searchQuery: string
  readonly selectedNoteId: NoteId | undefined
  readonly onCreateNote: () => void
  readonly onImportNotes: () => void
  readonly onOpenQuickNote: () => void
  readonly onSearchQueryChange: (query: string) => void
  readonly onSelectNote: (id: NoteId) => void
}

function SidebarEmptyState({
  hasSearchQuery,
  isLoading
}: {
  readonly hasSearchQuery: boolean
  readonly isLoading: boolean
}): React.JSX.Element {
  return (
    <div className="sidebar-empty-state">
      <span className="empty-state-icon empty-state-icon-small">
        {hasSearchQuery ? <SearchIcon size={18} /> : <NoteIcon size={18} />}
      </span>
      <h3>
        {isLoading
          ? 'Loading notes'
          : hasSearchQuery
            ? 'No notes found'
            : 'No notes yet'}
      </h3>
      <p>
        {isLoading
          ? 'Reading saved notes from this device.'
          : hasSearchQuery
            ? 'Try a different search term.'
            : 'Create your first note to start capturing ideas.'}
      </p>
    </div>
  )
}

export function AppSidebar({
  notes,
  noteCount,
  isLoading,
  statusMessage,
  searchQuery,
  selectedNoteId,
  onCreateNote,
  onImportNotes,
  onOpenQuickNote,
  onSearchQueryChange,
  onSelectNote
}: AppSidebarProps): React.JSX.Element {
  const hasSearchQuery = searchQuery.trim().length > 0

  return (
    <aside className="sidebar" aria-label="Notes sidebar">
      <div className="sidebar-header">
        <div className="app-identity">
          <span className="app-mark" aria-hidden="true">
            <NoteIcon size={16} />
          </span>
          <span>{APP_NAME}</span>
        </div>

        <button className="primary-button" type="button" onClick={onCreateNote}>
          <PlusIcon size={15} />
          <span>New note</span>
        </button>

        <button
          className="secondary-button sidebar-quick-button"
          type="button"
          onClick={onOpenQuickNote}
        >
          <NoteIcon size={15} />
          <span>Quick note</span>
        </button>

        <button
          className="secondary-button sidebar-import-button"
          type="button"
          onClick={onImportNotes}
        >
          <ImportIcon size={15} />
          <span>Import</span>
        </button>

        <label className="search-shell">
          <span className="visually-hidden">Search notes</span>
          <SearchIcon size={15} />
          <input
            type="search"
            placeholder="Search notes"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
      </div>

      <div className="notes-section">
        <div className="section-heading">
          <h2>All notes</h2>
          <span aria-label={`${noteCount} notes`}>{noteCount}</span>
        </div>

        {notes.length > 0 ? (
          <ul className="note-list">
            {notes.map((note) => {
              const isSelected = note.id === selectedNoteId

              return (
                <li className="note-list-item" key={note.id}>
                  <button
                    className={`note-list-button${isSelected ? ' note-list-button-selected' : ''}`}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectNote(note.id)}
                  >
                    <span className="note-list-heading">
                      <span className="note-list-title">{note.title}</span>
                      <time dateTime={note.updatedAt}>
                        {formatNoteUpdatedAt(note.updatedAt)}
                      </time>
                    </span>
                    <span className="note-list-preview">
                      {note.previewText || 'Empty note'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <SidebarEmptyState
            hasSearchQuery={hasSearchQuery}
            isLoading={isLoading}
          />
        )}
      </div>

      <footer className="sidebar-footer">
        <span
          className={`status-dot${statusMessage === 'Stored on this device' ? '' : ' status-dot-muted'}`}
          aria-hidden="true"
        />
        <span>{statusMessage}</span>
      </footer>
    </aside>
  )
}
