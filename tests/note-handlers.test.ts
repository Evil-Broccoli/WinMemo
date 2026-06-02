import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { createNoteHandlers } from '../src/main/notes/note-handlers'
import { NoteRepository } from '../src/main/persistence/note-repository'
import { migrateDatabase } from '../src/main/persistence/migrations'

function createTestHandlers() {
  const database = new DatabaseSync(':memory:')

  migrateDatabase(database)

  return {
    close: () => database.close(),
    handlers: createNoteHandlers(new NoteRepository(database))
  }
}

test('handles the persisted note CRUD flow', () => {
  const { close, handlers } = createTestHandlers()

  try {
    const createResult = handlers.create({
      contentMarkdown: '# First capture'
    })

    assert.equal(createResult.ok, true)

    if (!createResult.ok) {
      return
    }

    const noteId = createResult.value.id

    assert.deepEqual(handlers.list(), {
      ok: true,
      value: [
        {
          id: noteId,
          title: 'First capture',
          previewText: 'First capture',
          updatedAt: createResult.value.updatedAt,
          pinned: false,
          sourceType: 'note'
        }
      ]
    })
    assert.deepEqual(handlers.get({ id: noteId }), createResult)

    const updateResult = handlers.update({
      id: noteId,
      title: 'Updated capture',
      contentMarkdown: '# Updated capture\n\nWith details.'
    })

    assert.equal(updateResult.ok, true)

    if (updateResult.ok) {
      assert.equal(updateResult.value.title, 'Updated capture')
      assert.equal(
        updateResult.value.previewText,
        'Updated capture With details.'
      )
    }

    assert.deepEqual(handlers.delete({ id: noteId }), {
      ok: true,
      value: undefined
    })
    assert.deepEqual(handlers.list(), {
      ok: true,
      value: []
    })
  } finally {
    close()
  }
})

test('rejects malformed note IPC payloads', () => {
  const { close, handlers } = createTestHandlers()

  try {
    assert.equal(handlers.get({ id: '' }).ok, false)
    assert.equal(handlers.create({ unknown: true }).ok, false)
    assert.equal(handlers.update({ id: 'note-id' }).ok, false)
    assert.equal(handlers.delete({ id: 'note-id', extra: true }).ok, false)
  } finally {
    close()
  }
})

test('returns not-found errors for missing notes', () => {
  const { close, handlers } = createTestHandlers()

  try {
    assert.deepEqual(handlers.get({ id: 'missing' }), {
      ok: false,
      error: {
        code: 'not-found',
        message: 'The requested note was not found.'
      }
    })
    assert.equal(handlers.update({ id: 'missing', pinned: true }).ok, false)
    assert.equal(handlers.delete({ id: 'missing' }).ok, false)
  } finally {
    close()
  }
})

test('returns database errors without exposing raw failures', () => {
  const { close, handlers } = createTestHandlers()

  close()

  assert.deepEqual(handlers.list(), {
    ok: false,
    error: {
      code: 'database-failed',
      message: 'Unable to access the local notes database.'
    }
  })
})

test('loads saved notes after reopening the SQLite database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-memo-ipc-'))
  const databasePath = join(directory, 'notes.sqlite3')
  const firstDatabase = new DatabaseSync(databasePath)

  try {
    migrateDatabase(firstDatabase)

    const firstHandlers = createNoteHandlers(new NoteRepository(firstDatabase))
    const createResult = firstHandlers.create({
      contentMarkdown: '# Survives restart'
    })

    assert.equal(createResult.ok, true)
    firstDatabase.close()

    const reopenedDatabase = new DatabaseSync(databasePath)

    try {
      migrateDatabase(reopenedDatabase)

      const reopenedHandlers = createNoteHandlers(
        new NoteRepository(reopenedDatabase)
      )
      const listResult = reopenedHandlers.list()

      assert.equal(listResult.ok, true)

      if (listResult.ok) {
        assert.equal(listResult.value[0]?.title, 'Survives restart')
      }
    } finally {
      reopenedDatabase.close()
    }
  } finally {
    if (firstDatabase.isOpen) {
      firstDatabase.close()
    }

    rmSync(directory, { recursive: true, force: true })
  }
})
