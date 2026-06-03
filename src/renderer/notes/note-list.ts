import type { Note, NoteSummary } from '@shared/notes'
import {
  createNotePreviewText,
  deriveNoteTitle
} from '../../shared/note-content'

export function toNoteSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    previewText: note.previewText,
    updatedAt: note.updatedAt,
    pinned: note.pinned,
    sourceType: note.sourceType
  }
}

export function upsertNoteSummary(
  notes: readonly NoteSummary[],
  note: Note | NoteSummary
): readonly NoteSummary[] {
  const nextSummary = 'contentMarkdown' in note ? toNoteSummary(note) : note

  return [
    nextSummary,
    ...notes.filter((summary) => summary.id !== nextSummary.id)
  ]
}

export function updateNoteContent(
  note: Note,
  contentMarkdown: string,
  updatedAt: string
): Note {
  return {
    ...note,
    title: deriveNoteTitle(contentMarkdown),
    contentMarkdown,
    previewText: createNotePreviewText(contentMarkdown),
    updatedAt
  }
}

export function filterNoteSummaries<Summary extends NoteSummary>(
  notes: readonly Summary[],
  searchQuery: string
): readonly Summary[] {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()

  if (!normalizedQuery) {
    return notes
  }

  return notes.filter((note) => {
    const searchableText =
      `${note.title} ${note.previewText}`.toLocaleLowerCase()

    return searchableText.includes(normalizedQuery)
  })
}

export function formatNoteUpdatedAt(
  updatedAt: string,
  now = new Date()
): string {
  const updatedDate = new Date(updatedAt)

  if (Number.isNaN(updatedDate.getTime())) {
    return ''
  }

  if (
    updatedDate.getFullYear() === now.getFullYear() &&
    updatedDate.getMonth() === now.getMonth() &&
    updatedDate.getDate() === now.getDate()
  ) {
    return updatedDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return updatedDate.toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  })
}
