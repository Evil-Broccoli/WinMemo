import assert from 'node:assert/strict'
import test from 'node:test'
import { createQuickNoteHandlers } from '../src/main/windows/quick-note-handlers'
import type { Note, NoteCreateInput } from '../src/shared/notes'

function createNote(input: NoteCreateInput, index: number): Note {
  const contentMarkdown = input.contentMarkdown ?? ''

  return {
    id: `quick-note-${index}`,
    title: input.title ?? 'Quick capture',
    contentMarkdown,
    previewText: contentMarkdown,
    createdAt: '2026-06-03T02:00:00.000Z',
    updatedAt: '2026-06-03T02:00:00.000Z',
    pinned: input.pinned ?? false,
    sourceType: input.sourceType ?? 'note'
  }
}

function createController() {
  const windowState = {
    id: 12,
    kind: 'quick-note' as const,
    alwaysOnTop: false
  }
  const calls = {
    close: 0,
    cancel: 0
  }

  return {
    calls,
    controller: {
      open: () => windowState,
      closeAfterResponse: () => {
        calls.close += 1
      },
      cancelCloseRequest: () => {
        calls.cancel += 1
      }
    }
  }
}

function createRepository() {
  const createdInputs: NoteCreateInput[] = []

  return {
    createdInputs,
    repository: {
      create: (input: NoteCreateInput = {}) => {
        createdInputs.push(input)

        return createNote(input, createdInputs.length)
      }
    }
  }
}

test('opens the quick note window through the controller', () => {
  const { controller } = createController()
  const { repository } = createRepository()
  const handlers = createQuickNoteHandlers(controller, repository)

  assert.deepEqual(handlers.open(), {
    ok: true,
    value: {
      id: 12,
      kind: 'quick-note',
      alwaysOnTop: false
    }
  })
})

test('returns a user-facing error when the quick note window cannot open', () => {
  const { repository } = createRepository()
  const { controller } = createController()
  const handlers = createQuickNoteHandlers(
    {
      ...controller,
      open: () => {
        throw new Error('renderer entry missing')
      }
    },
    repository
  )

  assert.deepEqual(handlers.open(), {
    ok: false,
    error: {
      code: 'unknown',
      message: 'Unable to open the quick note window.'
    }
  })
})

test('saves quick note content with the quick-note source type', () => {
  const { controller } = createController()
  const { repository, createdInputs } = createRepository()
  const handlers = createQuickNoteHandlers(controller, repository)

  const result = handlers.save({
    contentMarkdown: '# Capture\n\nFast idea'
  })

  assert.equal(result.ok, true)
  assert.deepEqual(createdInputs, [
    {
      title: undefined,
      contentMarkdown: '# Capture\n\nFast idea',
      sourceType: 'quick-note'
    }
  ])

  if (result.ok) {
    assert.equal(result.value.sourceType, 'quick-note')
    assert.equal(result.value.contentMarkdown, '# Capture\n\nFast idea')
  }
})

test('notifies listeners after a quick note is saved', () => {
  const { controller } = createController()
  const { repository } = createRepository()
  const savedNotes: Note[] = []
  const handlers = createQuickNoteHandlers(controller, repository, {
    onSaved: (note) => {
      savedNotes.push(note)
    }
  })

  const result = handlers.save({
    contentMarkdown: 'Notify the list'
  })

  assert.equal(result.ok, true)
  assert.equal(savedNotes.length, 1)
  assert.equal(savedNotes[0]?.sourceType, 'quick-note')
  assert.equal(savedNotes[0]?.contentMarkdown, 'Notify the list')
})

test('save close response persists the draft and closes the window', () => {
  const { controller, calls } = createController()
  const { repository, createdInputs } = createRepository()
  const handlers = createQuickNoteHandlers(controller, repository)

  assert.deepEqual(
    handlers.respondToClose({
      action: 'save',
      draft: {
        contentMarkdown: 'Remember this'
      }
    }),
    {
      ok: true,
      value: undefined
    }
  )
  assert.deepEqual(createdInputs, [
    {
      title: undefined,
      contentMarkdown: 'Remember this',
      sourceType: 'quick-note'
    }
  ])
  assert.equal(calls.close, 1)
  assert.equal(calls.cancel, 0)
})

test('discard close response closes without saving', () => {
  const { controller, calls } = createController()
  const { repository, createdInputs } = createRepository()
  const handlers = createQuickNoteHandlers(controller, repository)

  assert.deepEqual(handlers.respondToClose({ action: 'discard' }), {
    ok: true,
    value: undefined
  })
  assert.deepEqual(createdInputs, [])
  assert.equal(calls.close, 1)
  assert.equal(calls.cancel, 0)
})

test('cancel close response keeps the window open without saving', () => {
  const { controller, calls } = createController()
  const { repository, createdInputs } = createRepository()
  const handlers = createQuickNoteHandlers(controller, repository)

  assert.deepEqual(handlers.respondToClose({ action: 'cancel' }), {
    ok: true,
    value: undefined
  })
  assert.deepEqual(createdInputs, [])
  assert.equal(calls.close, 0)
  assert.equal(calls.cancel, 1)
})

test('rejects empty quick note saves', () => {
  const { controller, calls } = createController()
  const { repository, createdInputs } = createRepository()
  const handlers = createQuickNoteHandlers(controller, repository)

  assert.deepEqual(
    handlers.respondToClose({
      action: 'save',
      draft: {
        contentMarkdown: '   '
      }
    }),
    {
      ok: false,
      error: {
        code: 'validation-failed',
        message: 'Quick note content is required before saving.'
      }
    }
  )
  assert.deepEqual(createdInputs, [])
  assert.equal(calls.close, 0)
})

test('does not close when saving fails', () => {
  const { controller, calls } = createController()
  const handlers = createQuickNoteHandlers(controller, {
    create: () => {
      throw new Error('database unavailable')
    }
  })

  assert.deepEqual(
    handlers.respondToClose({
      action: 'save',
      draft: {
        contentMarkdown: 'Keep me'
      }
    }),
    {
      ok: false,
      error: {
        code: 'database-failed',
        message: 'Unable to access the local notes database.'
      }
    }
  )
  assert.equal(calls.close, 0)
  assert.equal(calls.cancel, 0)
})
