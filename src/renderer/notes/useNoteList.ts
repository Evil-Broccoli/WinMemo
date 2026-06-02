import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { DesktopBridge } from '@shared/ipc'
import type { Note, NoteId, NoteSummary } from '@shared/notes'
import { AUTOSAVE_DELAY_MS, createAutosaveScheduler } from './autosave'
import {
  filterNoteSummaries,
  updateNoteContent,
  upsertNoteSummary
} from './note-list'

interface PendingNoteSave {
  readonly note: Note
  readonly sequence: number
}

interface NoteListState {
  readonly notes: readonly NoteSummary[]
  readonly visibleNotes: readonly NoteSummary[]
  readonly searchQuery: string
  readonly selectedNoteId: NoteId | undefined
  readonly selectedNote: Note | undefined
  readonly isLoading: boolean
  readonly statusMessage: string
  readonly createNote: () => void
  readonly deleteSelectedNote: () => void
  readonly selectNote: (id: NoteId) => void
  readonly setSearchQuery: (query: string) => void
  readonly updateSelectedNoteContent: (contentMarkdown: string) => void
}

function getNotesBridge(): DesktopBridge['notes'] | undefined {
  return window.desktop?.notes
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.'
}

export function useNoteList(): NoteListState {
  const [notes, setNotes] = useState<readonly NoteSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState<NoteId>()
  const [selectedNote, setSelectedNote] = useState<Note>()
  const [isLoading, setIsLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState('Loading notes...')
  const selectionSequence = useRef(0)
  const updateSequence = useRef(0)
  const selectedNoteRef = useRef<Note | undefined>(undefined)
  const [autosaveScheduler] = useState(() =>
    createAutosaveScheduler<PendingNoteSave>(
      async () => undefined,
      AUTOSAVE_DELAY_MS
    )
  )
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const visibleNotes = useMemo(
    () => filterNoteSummaries(notes, deferredSearchQuery),
    [deferredSearchQuery, notes]
  )

  const showError = useCallback((message: string) => {
    setStatusMessage(message)
  }, [])

  const savePendingNote = useCallback(
    async ({ note, sequence }: PendingNoteSave): Promise<void> => {
      const notesBridge = getNotesBridge()

      setStatusMessage('Saving...')

      if (!notesBridge) {
        const message = 'Desktop note storage is unavailable.'

        showError(message)
        throw new Error(message)
      }

      try {
        const result = await notesBridge.update({
          id: note.id,
          title: note.title,
          contentMarkdown: note.contentMarkdown
        })

        if (!result.ok) {
          throw new Error(result.error.message)
        }

        if (sequence !== updateSequence.current) {
          return
        }

        if (
          selectedNoteRef.current?.id === result.value.id &&
          selectedNoteRef.current.contentMarkdown === note.contentMarkdown
        ) {
          selectedNoteRef.current = result.value
        }

        setSelectedNote((currentNote) =>
          currentNote?.id === result.value.id &&
          currentNote.contentMarkdown === note.contentMarkdown
            ? result.value
            : currentNote
        )
        setNotes((currentNotes) =>
          upsertNoteSummary(currentNotes, result.value)
        )

        if (!autosaveScheduler.hasPending()) {
          setStatusMessage('Stored on this device')
        }
      } catch (error) {
        showError(`Autosave failed: ${getErrorMessage(error)}`)
        throw error
      }
    },
    [autosaveScheduler, showError]
  )

  useEffect(() => {
    autosaveScheduler.setSave(savePendingNote)
  }, [autosaveScheduler, savePendingNote])

  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    try {
      await autosaveScheduler.flush()
      return true
    } catch {
      return false
    }
  }, [autosaveScheduler])

  useEffect(() => {
    const flush = (): void => {
      void flushPendingSave()
    }

    window.addEventListener('blur', flush)
    window.addEventListener('pagehide', flush)

    return () => {
      window.removeEventListener('blur', flush)
      window.removeEventListener('pagehide', flush)
      void flushPendingSave()
    }
  }, [flushPendingSave])

  useEffect(() => {
    let closeAfterFlush = false

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (closeAfterFlush || !autosaveScheduler.hasUnsavedChanges()) {
        return
      }

      event.preventDefault()
      event.returnValue = ''

      void flushPendingSave().then((didSave) => {
        if (didSave) {
          closeAfterFlush = true
          window.close()
        }
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [autosaveScheduler, flushPendingSave])

  useEffect(() => {
    let isActive = true

    async function loadNotes(): Promise<void> {
      const notesBridge = getNotesBridge()

      if (!notesBridge) {
        if (isActive) {
          setIsLoading(false)
          showError('Desktop note storage is unavailable.')
        }

        return
      }

      try {
        const result = await notesBridge.list()

        if (!isActive) {
          return
        }

        if (result.ok) {
          setNotes(result.value)
          setStatusMessage('Stored on this device')
        } else {
          showError(result.error.message)
        }
      } catch (error) {
        if (isActive) {
          showError(getErrorMessage(error))
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadNotes()

    return () => {
      isActive = false
    }
  }, [showError])

  const createNote = useCallback(() => {
    const sequence = selectionSequence.current + 1

    selectionSequence.current = sequence

    async function create(): Promise<void> {
      if (
        !(await flushPendingSave()) ||
        sequence !== selectionSequence.current
      ) {
        return
      }

      const notesBridge = getNotesBridge()

      if (!notesBridge) {
        showError('Desktop note storage is unavailable.')
        return
      }

      try {
        const result = await notesBridge.create()

        if (!result.ok) {
          showError(result.error.message)
          return
        }

        setNotes((currentNotes) =>
          upsertNoteSummary(currentNotes, result.value)
        )

        if (sequence !== selectionSequence.current) {
          return
        }

        setSelectedNoteId(result.value.id)
        selectedNoteRef.current = result.value
        setSelectedNote(result.value)
        setStatusMessage('Stored on this device')
      } catch (error) {
        showError(getErrorMessage(error))
      }
    }

    void create()
  }, [flushPendingSave, showError])

  const selectNote = useCallback(
    (id: NoteId) => {
      if (selectedNoteRef.current?.id === id) {
        return
      }

      const sequence = selectionSequence.current + 1

      selectionSequence.current = sequence

      async function select(): Promise<void> {
        if (
          !(await flushPendingSave()) ||
          sequence !== selectionSequence.current
        ) {
          return
        }

        const notesBridge = getNotesBridge()

        if (!notesBridge) {
          showError('Desktop note storage is unavailable.')
          return
        }

        setSelectedNoteId(id)
        selectedNoteRef.current = undefined
        setSelectedNote(undefined)

        try {
          const result = await notesBridge.get(id)

          if (sequence !== selectionSequence.current) {
            return
          }

          if (result.ok) {
            selectedNoteRef.current = result.value
            setSelectedNote(result.value)
            setStatusMessage('Stored on this device')
          } else {
            showError(result.error.message)
          }
        } catch (error) {
          if (sequence === selectionSequence.current) {
            showError(getErrorMessage(error))
          }
        }
      }

      void select()
    },
    [flushPendingSave, showError]
  )

  const updateSelectedNoteContent = useCallback(
    (contentMarkdown: string) => {
      const currentNote = selectedNoteRef.current

      if (!currentNote || currentNote.contentMarkdown === contentMarkdown) {
        return
      }

      const optimisticNote = updateNoteContent(
        currentNote,
        contentMarkdown,
        new Date().toISOString()
      )
      const sequence = updateSequence.current + 1

      updateSequence.current = sequence
      selectedNoteRef.current = optimisticNote
      setSelectedNote(optimisticNote)
      setNotes((currentNotes) =>
        upsertNoteSummary(currentNotes, optimisticNote)
      )
      setStatusMessage('Unsaved changes')
      autosaveScheduler.schedule({ note: optimisticNote, sequence })
    },
    [autosaveScheduler]
  )

  const deleteSelectedNote = useCallback(() => {
    async function deleteNote(): Promise<void> {
      const noteToDelete = selectedNoteRef.current

      if (!noteToDelete) {
        return
      }

      selectionSequence.current += 1
      updateSequence.current += 1
      autosaveScheduler.discard()
      await autosaveScheduler.waitForIdle()
      autosaveScheduler.discard()

      const notesBridge = getNotesBridge()

      if (!notesBridge) {
        showError('Desktop note storage is unavailable.')
        return
      }

      try {
        const result = await notesBridge.delete(noteToDelete.id)

        if (!result.ok) {
          showError(result.error.message)
          return
        }

        setNotes((currentNotes) =>
          currentNotes.filter((note) => note.id !== noteToDelete.id)
        )

        if (selectedNoteRef.current?.id === noteToDelete.id) {
          selectedNoteRef.current = undefined
          setSelectedNoteId(undefined)
          setSelectedNote(undefined)
        }

        setStatusMessage('Stored on this device')
      } catch (error) {
        showError(getErrorMessage(error))
      }
    }

    void deleteNote()
  }, [autosaveScheduler, showError])

  return {
    notes,
    visibleNotes,
    searchQuery,
    selectedNoteId,
    selectedNote,
    isLoading,
    statusMessage,
    createNote,
    deleteSelectedNote,
    selectNote,
    setSearchQuery,
    updateSelectedNoteContent
  }
}
