import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import {
  DEFAULT_NOTE_TITLE,
  NOTE_PREVIEW_MAX_LENGTH,
  NoteRepository,
  createNotePreviewText
} from '../src/main/persistence/note-repository'
import { migrateDatabase } from '../src/main/persistence/migrations'

function createTestRepository(options?: {
  readonly ids?: readonly string[]
  readonly now?: () => Date
}) {
  const database = new DatabaseSync(':memory:')
  const ids = options?.ids ?? ['note-id']
  let idIndex = 0

  migrateDatabase(database)

  return {
    close: () => database.close(),
    repository: new NoteRepository(database, {
      createId: () => ids[idIndex++] ?? `note-id-${idIndex}`,
      now: options?.now
    })
  }
}

test('creates and loads a note with derived metadata', () => {
  const { close, repository } = createTestRepository({
    ids: ['grocery-note'],
    now: () => new Date('2026-06-01T08:00:00.000Z')
  })

  try {
    const note = repository.create({
      contentMarkdown:
        '# Grocery list\n\n- [ ] Milk\n- [x] Eggs\n\n[Recipe](https://example.com)',
      pinned: true,
      sourceType: 'imported'
    })

    assert.deepEqual(note, {
      id: 'grocery-note',
      title: 'Grocery list',
      contentMarkdown:
        '# Grocery list\n\n- [ ] Milk\n- [x] Eggs\n\n[Recipe](https://example.com)',
      previewText: 'Grocery list Milk Eggs Recipe',
      createdAt: '2026-06-01T08:00:00.000Z',
      updatedAt: '2026-06-01T08:00:00.000Z',
      pinned: true,
      sourceType: 'imported'
    })
    assert.deepEqual(repository.get(note.id), note)
  } finally {
    close()
  }
})

test('updates note content, preview text, title fallback, and timestamp', () => {
  let timestamp = '2026-06-01T08:00:00.000Z'
  const { close, repository } = createTestRepository({
    now: () => new Date(timestamp)
  })

  try {
    const createdNote = repository.create()
    assert.equal(createdNote.title, DEFAULT_NOTE_TITLE)

    timestamp = '2026-06-01T08:01:00.000Z'
    const updatedNote = repository.update({
      id: createdNote.id,
      contentMarkdown: '## Daily capture\n\nA short update.',
      pinned: true
    })

    assert.deepEqual(updatedNote, {
      ...createdNote,
      title: 'Daily capture',
      contentMarkdown: '## Daily capture\n\nA short update.',
      previewText: 'Daily capture A short update.',
      updatedAt: '2026-06-01T08:01:00.000Z',
      pinned: true
    })

    timestamp = '2026-06-01T08:02:00.000Z'
    const customTitleNote = repository.update({
      id: createdNote.id,
      title: 'Manual title'
    })
    const contentEditedNote = repository.update({
      id: createdNote.id,
      contentMarkdown: '# Replacement heading'
    })

    assert.equal(customTitleNote?.title, 'Manual title')
    assert.equal(contentEditedNote?.title, 'Manual title')
    assert.equal(contentEditedNote?.previewText, 'Replacement heading')
  } finally {
    close()
  }
})

test('lists summaries by most recent update first', () => {
  let timestamp = '2026-06-01T08:00:00.000Z'
  const { close, repository } = createTestRepository({
    ids: ['first-note', 'second-note'],
    now: () => new Date(timestamp)
  })

  try {
    const firstNote = repository.create({ contentMarkdown: '# First' })

    timestamp = '2026-06-01T08:01:00.000Z'
    const secondNote = repository.create({ contentMarkdown: '# Second' })

    timestamp = '2026-06-01T08:02:00.000Z'
    repository.update({
      id: firstNote.id,
      contentMarkdown: '# First\n\nUpdated.'
    })

    assert.deepEqual(repository.list(), [
      {
        id: 'first-note',
        title: 'First',
        previewText: 'First Updated.',
        updatedAt: '2026-06-01T08:02:00.000Z',
        pinned: false,
        sourceType: 'note'
      },
      {
        id: secondNote.id,
        title: 'Second',
        previewText: 'Second',
        updatedAt: '2026-06-01T08:01:00.000Z',
        pinned: false,
        sourceType: 'note'
      }
    ])
  } finally {
    close()
  }
})

test('returns missing results cleanly and deletes existing notes', () => {
  const { close, repository } = createTestRepository()

  try {
    const note = repository.create({ title: 'Temporary' })

    assert.equal(repository.get('missing-note'), undefined)
    assert.equal(
      repository.update({ id: 'missing-note', pinned: true }),
      undefined
    )
    assert.equal(repository.delete(note.id), true)
    assert.equal(repository.delete(note.id), false)
    assert.equal(repository.get(note.id), undefined)
  } finally {
    close()
  }
})

test('limits generated preview text to the configured maximum length', () => {
  const previewText = createNotePreviewText('a'.repeat(300))

  assert.equal(previewText.length, NOTE_PREVIEW_MAX_LENGTH)
  assert.match(previewText, /\.\.\.$/)
})
