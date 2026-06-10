import React, { useEffect, useState } from 'react'
import type { Note } from '@shared/notes'
import { getStatusTone } from '../notes/note-list'
import { AlertIcon, ExportIcon, NoteIcon, PlusIcon, TrashIcon } from './icons'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'

interface WorkspaceShellProps {
  readonly isLoading: boolean
  readonly loadErrorMessage: string | undefined
  readonly selectedNote: Note | undefined
  readonly statusMessage: string
  readonly onCreateNote: () => void
  readonly onContentChange: (contentMarkdown: string) => void
  readonly onDeleteNote: () => void
  readonly onExportNote: () => void
}

interface PendingDeleteNote {
  readonly id: string
  readonly title: string
}

interface DeleteNoteDialogProps {
  readonly noteTitle: string
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

export function DeleteNoteDialog({
  noteTitle,
  onCancel,
  onConfirm
}: DeleteNoteDialogProps): React.JSX.Element {
  return (
    <div className="confirmation-backdrop" role="presentation">
      <div
        className="confirmation-dialog"
        role="alertdialog"
        aria-labelledby="delete-note-title"
        aria-describedby="delete-note-description"
        aria-modal="true"
      >
        <span className="confirmation-dialog-icon" aria-hidden="true">
          <AlertIcon size={20} />
        </span>
        <h2 id="delete-note-title">Delete note?</h2>
        <p id="delete-note-description">
          This removes "{noteTitle}" from this device. This cannot be undone.
        </p>
        <div className="confirmation-actions">
          <button
            className="dialog-button"
            type="button"
            autoFocus
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="dialog-button dialog-button-danger"
            type="button"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export function WorkspaceShell({
  isLoading,
  loadErrorMessage,
  selectedNote,
  statusMessage,
  onCreateNote,
  onContentChange,
  onDeleteNote,
  onExportNote
}: WorkspaceShellProps): React.JSX.Element {
  const [pendingDeleteNote, setPendingDeleteNote] =
    useState<PendingDeleteNote>()
  const statusTone = getStatusTone(statusMessage)
  const hasLoadError = !isLoading && loadErrorMessage !== undefined

  useEffect(() => {
    if (pendingDeleteNote && selectedNote?.id !== pendingDeleteNote.id) {
      queueMicrotask(() => setPendingDeleteNote(undefined))
    }
  }, [pendingDeleteNote, selectedNote?.id])

  const requestDeleteNote = (): void => {
    if (selectedNote) {
      setPendingDeleteNote({
        id: selectedNote.id,
        title: selectedNote.title
      })
    }
  }

  const confirmDeleteNote = (): void => {
    if (selectedNote?.id === pendingDeleteNote?.id) {
      onDeleteNote()
    }

    setPendingDeleteNote(undefined)
  }

  const emptyStateTitle = isLoading
    ? 'Loading notes'
    : hasLoadError
      ? 'Notes unavailable'
      : 'No note selected'
  const emptyStateDescription = isLoading
    ? 'Reading saved notes from this device.'
    : hasLoadError
      ? (loadErrorMessage ?? 'Notes could not be loaded.')
      : 'Create a note or choose one from the sidebar to start writing.'
  const emptyStateIconClassName = [
    'empty-state-icon',
    'empty-state-icon-large',
    isLoading ? 'empty-state-icon-activity' : '',
    hasLoadError ? 'empty-state-icon-danger' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="workspace" aria-label="Note workspace">
      <header className="workspace-header">
        <div>
          <p className="workspace-context">Notes</p>
          <h1>{selectedNote?.title ?? 'No note selected'}</h1>
        </div>

        <div className="workspace-actions">
          {selectedNote ? (
            <>
              <button
                className="icon-button"
                type="button"
                aria-label="Export note"
                title="Export note"
                onClick={onExportNote}
              >
                <ExportIcon size={17} />
              </button>
              <button
                className="icon-button icon-button-danger"
                type="button"
                aria-label="Delete note"
                title="Delete note"
                onClick={requestDeleteNote}
              >
                <TrashIcon size={17} />
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="workspace-body">
        <section className="workspace-pane editor-pane" aria-label="Editor">
          <header className="pane-header">
            <h2>Editor</h2>
            {selectedNote ? (
              <span
                className={`save-status save-status-${statusTone}`}
                role="status"
                aria-live="polite"
                title={statusMessage}
              >
                {statusMessage}
              </span>
            ) : null}
          </header>
          {selectedNote ? (
            <MarkdownEditor
              key={selectedNote.id}
              contentMarkdown={selectedNote.contentMarkdown}
              onContentChange={onContentChange}
            />
          ) : null}
        </section>

        <section className="workspace-pane preview-pane" aria-label="Preview">
          <header className="pane-header">
            <h2>Preview</h2>
          </header>
          {selectedNote ? (
            <MarkdownPreview contentMarkdown={selectedNote.contentMarkdown} />
          ) : null}
        </section>

        {selectedNote ? null : (
          <div className="workspace-empty-state">
            <span className={emptyStateIconClassName}>
              {hasLoadError ? (
                <AlertIcon size={24} />
              ) : isLoading ? (
                <NoteIcon size={26} />
              ) : (
                <PlusIcon size={24} />
              )}
            </span>
            <h2>{emptyStateTitle}</h2>
            <p>{emptyStateDescription}</p>
            {isLoading || hasLoadError ? null : (
              <button
                className="secondary-button"
                type="button"
                onClick={onCreateNote}
              >
                <PlusIcon size={15} />
                <span>Create a note</span>
              </button>
            )}
          </div>
        )}
      </div>

      {pendingDeleteNote ? (
        <DeleteNoteDialog
          noteTitle={pendingDeleteNote.title}
          onCancel={() => setPendingDeleteNote(undefined)}
          onConfirm={confirmDeleteNote}
        />
      ) : null}
    </section>
  )
}
