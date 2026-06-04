import assert from 'node:assert/strict'
import test from 'node:test'
import { createDocumentHandlers } from '../src/main/documents/document-handlers'
import type { DocumentNoteRepository } from '../src/main/documents/document-handlers'
import {
  createNotePreviewText,
  deriveNoteTitle
} from '../src/shared/note-content'
import type { Note, NoteCreateInput } from '../src/shared/notes'

const STATIC_TIMESTAMP = '2026-06-04T08:00:00.000Z'

function createTestRepository(options?: {
  readonly notes?: readonly Note[]
  readonly throwOnCreate?: boolean
  readonly throwOnGet?: boolean
}): {
  readonly createdInputs: NoteCreateInput[]
  readonly repository: DocumentNoteRepository
} {
  const createdInputs: NoteCreateInput[] = []
  const notesById = new Map<string, Note>(
    options?.notes?.map((note) => [note.id, note])
  )
  let nextId = 1

  return {
    createdInputs,
    repository: {
      create: (input) => {
        if (options?.throwOnCreate) {
          throw new Error('database failed')
        }

        const contentMarkdown = input.contentMarkdown ?? ''
        const note: Note = {
          id: `imported-${nextId++}`,
          title: input.title ?? deriveNoteTitle(contentMarkdown),
          contentMarkdown,
          previewText: createNotePreviewText(contentMarkdown),
          createdAt: STATIC_TIMESTAMP,
          updatedAt: STATIC_TIMESTAMP,
          pinned: input.pinned ?? false,
          sourceType: input.sourceType ?? 'note'
        }

        createdInputs.push(input)
        notesById.set(note.id, note)

        return note
      },
      get: (id) => {
        if (options?.throwOnGet) {
          throw new Error('database failed')
        }

        return notesById.get(id)
      }
    }
  }
}

function createTestNote(overrides?: Partial<Note>): Note {
  return {
    id: 'note-1',
    title: 'Meeting notes',
    contentMarkdown: '# Meeting notes\n\nFollow up.',
    previewText: 'Meeting notes Follow up.',
    createdAt: STATIC_TIMESTAMP,
    updatedAt: STATIC_TIMESTAMP,
    pinned: false,
    sourceType: 'note',
    ...overrides
  }
}

function createTestHandlers({
  docxFiles = new Map<string, string>(),
  files = new Map<string, string>(),
  filePaths,
  repository = createTestRepository()
}: {
  readonly docxFiles?: ReadonlyMap<string, string>
  readonly files?: ReadonlyMap<string, string>
  readonly filePaths: readonly string[] | undefined
  readonly repository?: ReturnType<typeof createTestRepository>
}) {
  const handlers = createDocumentHandlers({
    dialog: {
      showImportFilePicker: async () => filePaths
    },
    repository: repository.repository,
    readTextFile: async (filePath) => {
      const content = files.get(filePath)

      if (content === undefined) {
        throw new Error('missing file')
      }

      return content
    },
    importDocxFile: async (filePath) => {
      const content = docxFiles.get(filePath)

      if (content === undefined) {
        throw new Error('missing docx')
      }

      return content
    }
  })

  return {
    createdInputs: repository.createdInputs,
    handlers
  }
}

test('returns cancelled when the import dialog is dismissed', async () => {
  const { handlers } = createTestHandlers({
    filePaths: undefined
  })

  assert.deepEqual(await handlers.importNotes(), {
    ok: true,
    value: {
      status: 'cancelled'
    }
  })
})

test('imports supported text and docx files as notes', async () => {
  const markdownPath = 'C:\\Users\\sangu\\Documents\\Capture.MD'
  const docxPath = 'C:\\Users\\sangu\\Documents\\memo.docx'
  const { createdInputs, handlers } = createTestHandlers({
    filePaths: [markdownPath, docxPath],
    files: new Map([[markdownPath, '# Markdown capture']]),
    docxFiles: new Map([[docxPath, '# Word capture\n\nImported body.']])
  })

  assert.deepEqual(await handlers.importNotes(), {
    ok: true,
    value: {
      status: 'imported',
      notes: [
        {
          id: 'imported-1',
          title: 'Markdown capture',
          previewText: 'Markdown capture',
          updatedAt: STATIC_TIMESTAMP,
          pinned: false,
          sourceType: 'imported'
        },
        {
          id: 'imported-2',
          title: 'Word capture',
          previewText: 'Word capture Imported body.',
          updatedAt: STATIC_TIMESTAMP,
          pinned: false,
          sourceType: 'imported'
        }
      ]
    }
  })
  assert.deepEqual(createdInputs, [
    {
      contentMarkdown: '# Markdown capture',
      sourceType: 'imported'
    },
    {
      contentMarkdown: '# Word capture\n\nImported body.',
      sourceType: 'imported'
    }
  ])
})

test('imports txt and md files as notes', async () => {
  const textPath = 'C:\\Users\\sangu\\Documents\\plain.txt'
  const markdownPath = 'C:\\Users\\sangu\\Documents\\Capture.MD'
  const { createdInputs, handlers } = createTestHandlers({
    filePaths: [textPath, markdownPath],
    files: new Map([
      [textPath, '\uFEFFPlain capture\r\nSecond line'],
      [markdownPath, '# Markdown capture\n\n- item']
    ])
  })

  assert.deepEqual(await handlers.importNotes(), {
    ok: true,
    value: {
      status: 'imported',
      notes: [
        {
          id: 'imported-1',
          title: 'Plain capture',
          previewText: 'Plain capture Second line',
          updatedAt: STATIC_TIMESTAMP,
          pinned: false,
          sourceType: 'imported'
        },
        {
          id: 'imported-2',
          title: 'Markdown capture',
          previewText: 'Markdown capture item',
          updatedAt: STATIC_TIMESTAMP,
          pinned: false,
          sourceType: 'imported'
        }
      ]
    }
  })
  assert.deepEqual(createdInputs, [
    {
      contentMarkdown: 'Plain capture\r\nSecond line',
      sourceType: 'imported'
    },
    {
      contentMarkdown: '# Markdown capture\n\n- item',
      sourceType: 'imported'
    }
  ])
})

test('returns a user-facing error when a text import cannot be read', async () => {
  const { createdInputs, handlers } = createTestHandlers({
    filePaths: ['C:\\Users\\sangu\\Documents\\missing.md']
  })

  assert.deepEqual(await handlers.importNotes(), {
    ok: false,
    error: {
      code: 'file-read-failed',
      message: 'Unable to read missing.md.'
    }
  })
  assert.deepEqual(createdInputs, [])
})

test('returns a user-facing error when a docx import cannot be converted', async () => {
  const { createdInputs, handlers } = createTestHandlers({
    filePaths: ['C:\\Users\\sangu\\Documents\\broken.docx']
  })

  assert.deepEqual(await handlers.importNotes(), {
    ok: false,
    error: {
      code: 'file-read-failed',
      message: 'Unable to read broken.docx.'
    }
  })
  assert.deepEqual(createdInputs, [])
})

test('returns a user-facing error when imported notes cannot be saved', async () => {
  const filePath = 'C:\\Users\\sangu\\Documents\\capture.md'
  const repository = createTestRepository({
    throwOnCreate: true
  })
  const { handlers } = createTestHandlers({
    filePaths: [filePath],
    files: new Map([[filePath, '# Capture']]),
    repository
  })

  assert.deepEqual(await handlers.importNotes(), {
    ok: false,
    error: {
      code: 'database-failed',
      message: 'Unable to save imported notes to the local database.'
    }
  })
  assert.deepEqual(repository.createdInputs, [])
})

test('rejects legacy doc files with conversion guidance', async () => {
  const { handlers } = createTestHandlers({
    filePaths: ['C:\\Users\\sangu\\Documents\\old.doc']
  })

  assert.deepEqual(await handlers.importNotes(), {
    ok: false,
    error: {
      code: 'unsupported-format',
      message:
        'Legacy .doc files are not supported. Please convert the file to .docx and import it again.'
    }
  })
})

test('rejects unsupported import formats', async () => {
  const { handlers } = createTestHandlers({
    filePaths: ['C:\\Users\\sangu\\Documents\\data.csv']
  })

  assert.deepEqual(await handlers.importNotes(), {
    ok: false,
    error: {
      code: 'unsupported-format',
      message: 'Windows Memo can import .txt, .md, and .docx files.'
    }
  })
})

test('returns a user-facing error when the import dialog fails', async () => {
  const repository = createTestRepository()
  const handlers = createDocumentHandlers({
    dialog: {
      showImportFilePicker: async () => {
        throw new Error('dialog failed')
      }
    },
    repository: repository.repository
  })

  assert.deepEqual(await handlers.importNotes(), {
    ok: false,
    error: {
      code: 'unknown',
      message: 'Unable to open the import file picker.'
    }
  })
})

test('returns cancelled when the export dialog is dismissed', async () => {
  const note = createTestNote()
  const repository = createTestRepository({
    notes: [note]
  })
  const handlers = createDocumentHandlers({
    dialog: {
      showExportFilePicker: async () => undefined
    },
    repository: repository.repository
  })

  assert.deepEqual(
    await handlers.exportNote({
      noteId: note.id,
      format: 'md'
    }),
    {
      ok: true,
      value: {
        status: 'cancelled'
      }
    }
  )
})

test('passes selected export destination and note data to the export pipeline', async () => {
  const note = createTestNote()
  const repository = createTestRepository({
    notes: [note]
  })
  const exportedInputs: Array<{
    readonly note: Note
    readonly filePath: string
    readonly format: string
  }> = []
  const dialogInputs: Array<{
    readonly note: Note
    readonly format: string
  }> = []
  const handlers = createDocumentHandlers({
    dialog: {
      showExportFilePicker: async (input) => {
        dialogInputs.push(input)

        return 'C:\\Users\\sangu\\Documents\\meeting.txt'
      }
    },
    repository: repository.repository,
    exportNoteFile: async (input) => {
      exportedInputs.push(input)

      return {
        status: 'exported',
        filePath: input.filePath,
        format: input.format
      }
    }
  })

  assert.deepEqual(
    await handlers.exportNote({
      noteId: note.id,
      format: 'md'
    }),
    {
      ok: true,
      value: {
        status: 'exported',
        filePath: 'C:\\Users\\sangu\\Documents\\meeting.txt',
        format: 'txt'
      }
    }
  )
  assert.deepEqual(dialogInputs, [
    {
      note,
      format: 'md'
    }
  ])
  assert.deepEqual(exportedInputs, [
    {
      note,
      filePath: 'C:\\Users\\sangu\\Documents\\meeting.txt',
      format: 'txt'
    }
  ])
})

test('returns selected export destination before format writers are attached', async () => {
  const note = createTestNote()
  const repository = createTestRepository({
    notes: [note]
  })
  const handlers = createDocumentHandlers({
    dialog: {
      showExportFilePicker: async () =>
        'C:\\Users\\sangu\\Documents\\meeting-export'
    },
    repository: repository.repository
  })

  assert.deepEqual(
    await handlers.exportNote({
      noteId: note.id,
      format: 'docx'
    }),
    {
      ok: true,
      value: {
        status: 'selected',
        filePath: 'C:\\Users\\sangu\\Documents\\meeting-export.docx',
        format: 'docx'
      }
    }
  )
})

test('rejects unsupported export destination formats', async () => {
  const note = createTestNote()
  const repository = createTestRepository({
    notes: [note]
  })
  const handlers = createDocumentHandlers({
    dialog: {
      showExportFilePicker: async () => 'C:\\Users\\sangu\\Documents\\old.doc'
    },
    repository: repository.repository
  })

  assert.deepEqual(
    await handlers.exportNote({
      noteId: note.id,
      format: 'md'
    }),
    {
      ok: false,
      error: {
        code: 'unsupported-format',
        message: 'Legacy .doc files are not supported. Export as .docx instead.'
      }
    }
  )
})

test('returns a user-facing error when the export payload is invalid', async () => {
  const repository = createTestRepository()
  const handlers = createDocumentHandlers({
    dialog: {},
    repository: repository.repository
  })

  assert.deepEqual(await handlers.exportNote({ noteId: 'note-1' }), {
    ok: false,
    error: {
      code: 'validation-failed',
      message: 'A supported export format is required.'
    }
  })
})

test('returns a user-facing error when the export note is missing', async () => {
  const repository = createTestRepository()
  const handlers = createDocumentHandlers({
    dialog: {},
    repository: repository.repository
  })

  assert.deepEqual(
    await handlers.exportNote({
      noteId: 'missing-note',
      format: 'md'
    }),
    {
      ok: false,
      error: {
        code: 'not-found',
        message: 'The selected note was not found.'
      }
    }
  )
})

test('returns a user-facing error when the export dialog fails', async () => {
  const note = createTestNote()
  const repository = createTestRepository({
    notes: [note]
  })
  const handlers = createDocumentHandlers({
    dialog: {
      showExportFilePicker: async () => {
        throw new Error('dialog failed')
      }
    },
    repository: repository.repository
  })

  assert.deepEqual(
    await handlers.exportNote({
      noteId: note.id,
      format: 'md'
    }),
    {
      ok: false,
      error: {
        code: 'unknown',
        message: 'Unable to open the export save dialog.'
      }
    }
  )
})
