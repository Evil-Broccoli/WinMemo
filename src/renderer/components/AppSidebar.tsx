import React from 'react'
import type { NoteId, NoteSummary } from '@shared/notes'
import { APP_NAME } from '../../shared/constants'
import { formatNoteUpdatedAt, getStatusTone } from '../notes/note-list'
import {
  AlertIcon,
  ImportIcon,
  NoteIcon,
  PlusIcon,
  SearchIcon,
  XIcon
} from './icons'

interface AppSidebarProps {
  readonly notes: readonly NoteSummary[]
  readonly noteCount: number
  readonly isLoading: boolean
  readonly loadErrorMessage: string | undefined
  readonly statusMessage: string
  readonly searchQuery: string
  readonly selectedNoteId: NoteId | undefined
  readonly onCreateNote: () => void
  readonly onImportNotes: () => void
  readonly onOpenQuickNote: () => void
  readonly onRetryLoadNotes: () => void
  readonly onSearchQueryChange: (query: string) => void
  readonly onSelectNote: (id: NoteId) => void
}

function SidebarEmptyState({
  hasSearchQuery,
  isLoading,
  loadErrorMessage,
  onRetryLoadNotes
}: {
  readonly hasSearchQuery: boolean
  readonly isLoading: boolean
  readonly loadErrorMessage: string | undefined
  readonly onRetryLoadNotes: () => void
}): React.JSX.Element {
  const hasLoadError = !isLoading && loadErrorMessage !== undefined
  const emptyStateTitle = isLoading
    ? 'Loading notes'
    : hasLoadError
      ? 'Notes unavailable'
      : hasSearchQuery
        ? 'No notes found'
        : 'No notes yet'
  const emptyStateDescription = isLoading
    ? 'Reading saved notes from this device.'
    : hasLoadError
      ? (loadErrorMessage ?? 'Notes could not be loaded.')
      : hasSearchQuery
        ? 'Try a different search term.'
        : 'Create your first note to start capturing ideas.'

  return (
    <div className="sidebar-empty-state">
      <span
        className={`empty-state-icon empty-state-icon-small${hasLoadError ? ' empty-state-icon-danger' : ''}`}
      >
        {hasLoadError ? (
          <AlertIcon size={18} />
        ) : hasSearchQuery ? (
          <SearchIcon size={18} />
        ) : (
          <NoteIcon size={18} />
        )}
      </span>
      <h3>{emptyStateTitle}</h3>
      <p>{emptyStateDescription}</p>
      {hasLoadError ? (
        <button
          className="secondary-button sidebar-empty-action"
          type="button"
          onClick={onRetryLoadNotes}
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function AppSidebar({
  notes,
  noteCount,
  isLoading,
  loadErrorMessage,
  statusMessage,
  searchQuery,
  selectedNoteId,
  onCreateNote,
  onImportNotes,
  onOpenQuickNote,
  onRetryLoadNotes,
  onSearchQueryChange,
  onSelectNote
}: AppSidebarProps): React.JSX.Element {
  const hasSearchQuery = searchQuery.trim().length > 0
  const statusTone = getStatusTone(statusMessage)
  const noteCountLabel = hasSearchQuery
    ? `${noteCount} matching note${noteCount === 1 ? '' : 's'}`
    : `${noteCount} note${noteCount === 1 ? '' : 's'}`

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

        <div className="search-shell">
          <SearchIcon size={15} />
          <label className="visually-hidden" htmlFor="notes-search">
            Search notes
          </label>
          <input
            id="notes-search"
            type="search"
            placeholder="Search notes"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
          {hasSearchQuery ? (
            <button
              className="search-clear-button"
              type="button"
              aria-label="Clear search"
              title="Clear search"
              onClick={() => onSearchQueryChange('')}
            >
              <XIcon size={13} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="notes-section">
        <div className="section-heading">
          <h2>{hasSearchQuery ? 'Search results' : 'All notes'}</h2>
          <span aria-label={noteCountLabel}>{noteCount}</span>
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
            loadErrorMessage={loadErrorMessage}
            onRetryLoadNotes={onRetryLoadNotes}
          />
        )}
      </div>

      <footer className="sidebar-footer">
        <span
          className={`status-dot status-dot-${statusTone}`}
          aria-hidden="true"
        />
        <span>{statusMessage}</span>
      </footer>
    </aside>
  )
}
