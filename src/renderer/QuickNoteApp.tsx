import React, { useCallback, useEffect, useRef, useState } from 'react'
import type {
  QuickNoteCloseAction,
  QuickNoteCloseRequest,
  QuickNoteCloseResponseInput
} from '@shared/quick-note'
import { NoteIcon, PinIcon, XIcon } from './components/icons'
import { hasSavableQuickNoteDraft } from './quick-note-draft'

interface QuickNoteClosePromptProps {
  readonly characterCount: number
  readonly errorMessage: string
  readonly pendingAction: QuickNoteCloseAction | undefined
  readonly onSave: () => void
  readonly onDiscard: () => void
  readonly onCancel: () => void
}

export function QuickNoteClosePrompt({
  characterCount,
  errorMessage,
  pendingAction,
  onSave,
  onDiscard,
  onCancel
}: QuickNoteClosePromptProps): React.JSX.Element {
  const isPending = pendingAction !== undefined

  return (
    <div className="quick-note-close-backdrop">
      <section
        className="quick-note-close-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="quick-note-close-title"
        aria-describedby="quick-note-close-description"
      >
        <h2 id="quick-note-close-title">Save quick note?</h2>
        <p id="quick-note-close-description">
          Keep this capture as a note or discard the draft.
        </p>
        {errorMessage ? (
          <p className="quick-note-close-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="quick-note-close-actions">
          <button
            className="quick-note-dialog-button quick-note-dialog-button-danger"
            type="button"
            disabled={isPending}
            onClick={onDiscard}
          >
            {pendingAction === 'discard' ? 'Discarding' : 'Discard'}
          </button>
          <button
            className="quick-note-dialog-button"
            type="button"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="quick-note-dialog-button quick-note-dialog-button-primary"
            type="button"
            disabled={isPending || characterCount === 0}
            onClick={onSave}
          >
            {pendingAction === 'save' ? 'Saving' : 'Save'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function QuickNoteApp(): React.JSX.Element {
  const [contentMarkdown, setContentMarkdown] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [isPinPending, setIsPinPending] = useState(false)
  const [pinStatus, setPinStatus] = useState('Unpinned')
  const [closeRequest, setCloseRequest] = useState<QuickNoteCloseRequest>()
  const [closeError, setCloseError] = useState('')
  const [pendingCloseAction, setPendingCloseAction] =
    useState<QuickNoteCloseAction>()
  const contentMarkdownRef = useRef(contentMarkdown)
  const trimmedContentLength = contentMarkdown.trim().length
  const draftStatus =
    pendingCloseAction === 'save'
      ? 'Saving...'
      : pendingCloseAction === 'discard'
        ? 'Discarding...'
        : closeRequest
          ? 'Close requested'
          : trimmedContentLength === 0
            ? 'Draft'
            : 'Unsaved draft'

  useEffect(() => {
    let isCurrent = true

    void (async () => {
      try {
        const result = await window.desktop?.window.getState()

        if (!isCurrent || !result) {
          return
        }

        if (result.ok && result.value.kind === 'quick-note') {
          setIsPinned(result.value.alwaysOnTop)
          setPinStatus(result.value.alwaysOnTop ? 'Pinned' : 'Unpinned')
        } else if (!result.ok) {
          setPinStatus(result.error.message)
        }
      } catch {
        if (isCurrent) {
          setPinStatus('Unable to read window state')
        }
      }
    })()

    return () => {
      isCurrent = false
    }
  }, [])

  const respondToCloseRequest = useCallback(
    async (input: QuickNoteCloseResponseInput): Promise<boolean> => {
      let didSucceed = false

      setPendingCloseAction(input.action)
      setCloseError('')

      try {
        const result = await window.desktop?.quickNote.respondToClose(input)

        if (!result) {
          setCloseError('Desktop bridge is unavailable')
          return false
        }

        if (!result.ok) {
          setCloseError(result.error.message)
          return false
        }

        didSucceed = true

        if (input.action === 'cancel') {
          setCloseRequest(undefined)
        }

        return true
      } catch {
        setCloseError('Unable to close quick note')
        return false
      } finally {
        if (!didSucceed || input.action === 'cancel') {
          setPendingCloseAction(undefined)
        }
      }
    },
    []
  )

  useEffect(() => {
    const unsubscribe = window.desktop?.quickNote.onCloseRequested(
      (request) => {
        if (!hasSavableQuickNoteDraft(contentMarkdownRef.current)) {
          void respondToCloseRequest({ action: 'discard' }).then(
            (didDiscard) => {
              if (!didDiscard) {
                setCloseRequest(request)
              }
            }
          )
          return
        }

        setCloseRequest(request)
        setCloseError('')
        setPendingCloseAction(undefined)
      }
    )

    return () => {
      unsubscribe?.()
    }
  }, [respondToCloseRequest])

  const toggleAlwaysOnTop = (): void => {
    const nextPinnedState = !isPinned

    setIsPinPending(true)
    setPinStatus(nextPinnedState ? 'Pinning' : 'Unpinning')

    void (async () => {
      try {
        const result =
          await window.desktop?.window.setAlwaysOnTop(nextPinnedState)

        if (result?.ok) {
          setIsPinned(result.value.alwaysOnTop)
          setPinStatus(result.value.alwaysOnTop ? 'Pinned' : 'Unpinned')
        } else {
          setPinStatus(result?.error.message ?? 'Desktop bridge is unavailable')
        }
      } catch {
        setPinStatus('Unable to update window')
      } finally {
        setIsPinPending(false)
      }
    })()
  }

  const updateContentMarkdown = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ): void => {
    contentMarkdownRef.current = event.target.value
    setContentMarkdown(event.target.value)
  }

  const saveAndClose = (): void => {
    void respondToCloseRequest({
      action: 'save',
      draft: {
        contentMarkdown: contentMarkdownRef.current
      }
    })
  }

  const discardAndClose = (): void => {
    void respondToCloseRequest({ action: 'discard' })
  }

  const cancelClose = (): void => {
    void respondToCloseRequest({ action: 'cancel' })
  }

  return (
    <main className="quick-note-shell" aria-label="Quick note window">
      <section className="quick-note-window">
        <header className="quick-note-titlebar">
          <div className="quick-note-title">
            <NoteIcon size={15} />
            <span>Quick note</span>
          </div>
          <div className="quick-note-window-actions">
            <button
              className={`quick-note-icon-button${isPinned ? ' quick-note-icon-button-active' : ''}`}
              type="button"
              aria-label={isPinned ? 'Unpin quick note' : 'Pin quick note'}
              aria-pressed={isPinned}
              title={isPinned ? 'Unpin' : 'Pin'}
              disabled={isPinPending}
              onClick={toggleAlwaysOnTop}
            >
              <PinIcon size={15} />
            </button>
            <button
              className="quick-note-icon-button"
              type="button"
              aria-label="Close quick note"
              title="Close"
              onClick={() => window.close()}
            >
              <XIcon size={16} />
            </button>
          </div>
        </header>
        <textarea
          className="quick-note-editor"
          aria-label="Quick note content"
          placeholder="Start typing..."
          value={contentMarkdown}
          disabled={closeRequest !== undefined}
          onChange={updateContentMarkdown}
          autoFocus
        />
        <footer className="quick-note-footer">
          <span>{draftStatus}</span>
          <span className="quick-note-footer-meta">
            <span>{pinStatus}</span>
            <span>{contentMarkdown.length} chars</span>
          </span>
        </footer>
        {closeRequest ? (
          <QuickNoteClosePrompt
            characterCount={trimmedContentLength}
            errorMessage={closeError}
            pendingAction={pendingCloseAction}
            onSave={saveAndClose}
            onDiscard={discardAndClose}
            onCancel={cancelClose}
          />
        ) : null}
      </section>
    </main>
  )
}
