import { NOTE_SOURCE_TYPES } from '../../shared/notes'
import type {
  Note,
  NoteCreateInput,
  NoteId,
  NoteSummary,
  NoteUpdateInput
} from '../../shared/notes'
import type { AppErrorCode, AppResult, EmptyResult } from '../../shared/result'

interface NoteRepository {
  readonly list: () => NoteSummary[]
  readonly get: (id: NoteId) => Note | undefined
  readonly create: (input?: NoteCreateInput) => Note
  readonly update: (input: NoteUpdateInput) => Note | undefined
  readonly delete: (id: NoteId) => boolean
}

export interface NoteHandlers {
  readonly list: () => AppResult<readonly NoteSummary[]>
  readonly get: (request: unknown) => AppResult<Note>
  readonly create: (request: unknown) => AppResult<Note>
  readonly update: (request: unknown) => AppResult<Note>
  readonly delete: (request: unknown) => EmptyResult
}

const NOTE_CREATE_FIELDS = ['title', 'contentMarkdown', 'pinned', 'sourceType']
const NOTE_UPDATE_FIELDS = ['id', 'title', 'contentMarkdown', 'pinned']
const NOTE_ID_FIELDS = ['id']
const NOTE_ID_MAX_LENGTH = 256

function success<Value>(value: Value): AppResult<Value> {
  return {
    ok: true,
    value
  }
}

function failure(code: AppErrorCode, message: string): AppResult<never> {
  return {
    ok: false,
    error: {
      code,
      message
    }
  }
}

function validationFailure(message: string): AppResult<never> {
  return failure('validation-failed', message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyFields(
  value: Record<string, unknown>,
  allowedFields: readonly string[]
): boolean {
  return Object.keys(value).every((key) => allowedFields.includes(key))
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean'
}

function isNoteSourceType(
  value: unknown
): value is NoteCreateInput['sourceType'] {
  return (
    value === undefined ||
    NOTE_SOURCE_TYPES.some((sourceType) => sourceType === value)
  )
}

function parseNoteIdRequest(request: unknown): AppResult<Pick<Note, 'id'>> {
  if (
    !isRecord(request) ||
    !hasOnlyFields(request, NOTE_ID_FIELDS) ||
    typeof request.id !== 'string' ||
    request.id.trim() !== request.id ||
    request.id.length === 0 ||
    request.id.length > NOTE_ID_MAX_LENGTH
  ) {
    return validationFailure('A valid note id is required.')
  }

  return success({ id: request.id })
}

function parseNoteCreateInput(request: unknown): AppResult<NoteCreateInput> {
  if (request === undefined) {
    return success({})
  }

  if (
    !isRecord(request) ||
    !hasOnlyFields(request, NOTE_CREATE_FIELDS) ||
    !isOptionalString(request.title) ||
    !isOptionalString(request.contentMarkdown) ||
    !isOptionalBoolean(request.pinned) ||
    !isNoteSourceType(request.sourceType)
  ) {
    return validationFailure('The note create payload is invalid.')
  }

  return success({
    title: request.title,
    contentMarkdown: request.contentMarkdown,
    pinned: request.pinned,
    sourceType: request.sourceType
  })
}

function parseNoteUpdateInput(request: unknown): AppResult<NoteUpdateInput> {
  const idResult = parseNoteIdRequest(
    isRecord(request) ? { id: request.id } : request
  )

  if (!idResult.ok) {
    return idResult
  }

  if (
    !isRecord(request) ||
    !hasOnlyFields(request, NOTE_UPDATE_FIELDS) ||
    !isOptionalString(request.title) ||
    !isOptionalString(request.contentMarkdown) ||
    !isOptionalBoolean(request.pinned) ||
    (request.title === undefined &&
      request.contentMarkdown === undefined &&
      request.pinned === undefined)
  ) {
    return validationFailure('The note update payload is invalid.')
  }

  if (request.title !== undefined) {
    return success({
      id: idResult.value.id,
      title: request.title,
      contentMarkdown: request.contentMarkdown,
      pinned: request.pinned
    })
  }

  if (request.contentMarkdown !== undefined) {
    return success({
      id: idResult.value.id,
      contentMarkdown: request.contentMarkdown,
      pinned: request.pinned
    })
  }

  return success({
    id: idResult.value.id,
    pinned: request.pinned as boolean
  })
}

function runDatabaseOperation<Value>(
  operation: () => AppResult<Value>
): AppResult<Value> {
  try {
    return operation()
  } catch {
    return failure(
      'database-failed',
      'Unable to access the local notes database.'
    )
  }
}

export function createNoteHandlers(repository: NoteRepository): NoteHandlers {
  return {
    list: () => runDatabaseOperation(() => success(repository.list())),
    get: (request) => {
      const input = parseNoteIdRequest(request)

      if (!input.ok) {
        return input
      }

      return runDatabaseOperation(() => {
        const note = repository.get(input.value.id)

        return note
          ? success(note)
          : failure('not-found', 'The requested note was not found.')
      })
    },
    create: (request) => {
      const input = parseNoteCreateInput(request)

      if (!input.ok) {
        return input
      }

      return runDatabaseOperation(() => success(repository.create(input.value)))
    },
    update: (request) => {
      const input = parseNoteUpdateInput(request)

      if (!input.ok) {
        return input
      }

      return runDatabaseOperation(() => {
        const note = repository.update(input.value)

        return note
          ? success(note)
          : failure('not-found', 'The requested note was not found.')
      })
    },
    delete: (request) => {
      const input = parseNoteIdRequest(request)

      if (!input.ok) {
        return input
      }

      return runDatabaseOperation(() =>
        repository.delete(input.value.id)
          ? success(undefined)
          : failure('not-found', 'The requested note was not found.')
      )
    }
  }
}
