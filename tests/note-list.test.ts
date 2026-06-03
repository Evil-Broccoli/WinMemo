import assert from 'node:assert/strict'
import test from 'node:test'
import type { NoteSummary } from '../src/shared/notes'
import {
  filterNoteSummaries,
  formatNoteUpdatedAt,
  toNoteSummary,
  updateNoteContent,
  upsertNoteSummary
} from '../src/renderer/notes/note-list'

const notes = [
  createNoteSummary('one', 'Project ideas', 'Sketch a new capture flow'),
  createNoteSummary('two', 'Shopping list', 'Coffee beans and tea'),
  createNoteSummary('three', 'Meeting notes', 'Project planning follow-up')
]

function createNoteSummary(
  id: string,
  title: string,
  previewText: string
): NoteSummary {
  return {
    id,
    title,
    previewText,
    updatedAt: '2026-06-02T08:00:00.000Z',
    pinned: false,
    sourceType: 'note'
  }
}

test('updates note content with repository-compatible title and preview metadata', () => {
  const note = createNote('note-1')
  const updatedNote = updateNoteContent(
    note,
    '# Daily capture\n\n- First idea',
    '2026-06-02T10:01:00.000Z'
  )

  assert.deepEqual(updatedNote, {
    ...note,
    title: 'Daily capture',
    contentMarkdown: '# Daily capture\n\n- First idea',
    previewText: 'Daily capture First idea',
    updatedAt: '2026-06-02T10:01:00.000Z'
  })
})

test('keeps the note title derived from the latest Markdown content', () => {
  const note = createNote('note-1')
  const titledNote = updateNoteContent(
    note,
    '# Daily capture',
    '2026-06-02T10:01:00.000Z'
  )
  const updatedNote = updateNoteContent(
    titledNote,
    '# Replacement heading',
    '2026-06-02T10:02:00.000Z'
  )

  assert.equal(updatedNote.title, 'Replacement heading')
  assert.equal(updatedNote.previewText, 'Replacement heading')
})

test('converts and moves updated note summaries to the front of the list', () => {
  const note = createNote('note-1')
  const summaries = [createNoteSummary('note-2', 'Second', 'Another note')]

  assert.deepEqual(upsertNoteSummary(summaries, note), [
    toNoteSummary(note),
    summaries[0]
  ])
})

test('moves changed note summaries from cross-window events to the front', () => {
  const currentSummary = createNoteSummary('note-1', 'Older', 'Old preview')
  const changedSummary = {
    ...currentSummary,
    title: 'Quick capture',
    previewText: 'Saved from the floating window',
    sourceType: 'quick-note' as const
  }
  const summaries = [
    currentSummary,
    createNoteSummary('note-2', 'Second', 'Another note')
  ]

  assert.deepEqual(upsertNoteSummary(summaries, changedSummary), [
    changedSummary,
    summaries[1]
  ])
})

test('filters note summaries by trimmed case-insensitive title or preview text', () => {
  assert.deepEqual(filterNoteSummaries(notes, '  PROJECT '), [
    notes[0],
    notes[2]
  ])
  assert.deepEqual(filterNoteSummaries(notes, 'tea'), [notes[1]])
})

test('returns the original note summaries when the search query is blank', () => {
  assert.equal(filterNoteSummaries(notes, '   '), notes)
})

test('formats current-day timestamps as time and older timestamps as dates', () => {
  const now = new Date('2026-06-02T12:00:00.000Z')

  assert.match(formatNoteUpdatedAt('2026-06-02T08:00:00.000Z', now), /\d/)
  assert.match(formatNoteUpdatedAt('2026-05-30T08:00:00.000Z', now), /\d/)
  assert.equal(formatNoteUpdatedAt('not-a-date', now), '')
})

function createNote(id: string) {
  return {
    id,
    title: 'Untitled note',
    contentMarkdown: '',
    previewText: '',
    createdAt: '2026-06-02T10:00:00.000Z',
    updatedAt: '2026-06-02T10:00:00.000Z',
    pinned: false,
    sourceType: 'note' as const
  }
}
