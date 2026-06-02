import type { Note } from '@shared/notes'
import { MoreHorizontalIcon, NoteIcon, PlusIcon, TrashIcon } from './icons'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'

interface WorkspaceShellProps {
  readonly selectedNote: Note | undefined
  readonly statusMessage: string
  readonly onCreateNote: () => void
  readonly onContentChange: (contentMarkdown: string) => void
  readonly onDeleteNote: () => void
}

export function WorkspaceShell({
  selectedNote,
  statusMessage,
  onCreateNote,
  onContentChange,
  onDeleteNote
}: WorkspaceShellProps): React.JSX.Element {
  const handleDeleteNote = (): void => {
    if (
      selectedNote &&
      window.confirm(`Delete "${selectedNote.title}"? This cannot be undone.`)
    ) {
      onDeleteNote()
    }
  }

  return (
    <section className="workspace" aria-label="Note workspace">
      <header className="workspace-header">
        <div>
          <p className="workspace-context">Notes</p>
          <h1>{selectedNote?.title ?? 'No note selected'}</h1>
        </div>

        <div className="workspace-actions">
          {selectedNote ? (
            <button
              className="icon-button icon-button-danger"
              type="button"
              aria-label="Delete note"
              onClick={handleDeleteNote}
            >
              <TrashIcon size={17} />
            </button>
          ) : null}
          <button
            className="icon-button"
            type="button"
            aria-label="More note actions"
            disabled
          >
            <MoreHorizontalIcon size={18} />
          </button>
        </div>
      </header>

      <div className="workspace-body">
        <section className="workspace-pane editor-pane" aria-label="Editor">
          <header className="pane-header">
            <h2>Editor</h2>
            {selectedNote ? (
              <span
                className="save-status"
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
            <span className="empty-state-icon empty-state-icon-large">
              <NoteIcon size={26} />
            </span>
            <h2>No note selected</h2>
            <p>
              Create a note or choose one from the sidebar to start writing.
            </p>
            <button
              className="secondary-button"
              type="button"
              onClick={onCreateNote}
            >
              <PlusIcon size={15} />
              <span>Create a note</span>
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
