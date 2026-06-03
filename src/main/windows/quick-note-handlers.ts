import type { DesktopWindowState } from '../../shared/desktop'
import type { Note, NoteCreateInput } from '../../shared/notes'
import type {
  QuickNoteCloseResponseInput,
  QuickNoteSaveInput
} from '../../shared/quick-note'
import type { AppErrorCode, AppResult, EmptyResult } from '../../shared/result'

interface QuickNoteWindowController {
  readonly open: () => DesktopWindowState
  readonly closeAfterResponse: () => void
  readonly cancelCloseRequest: () => void
}

interface NoteRepository {
  readonly create: (input?: NoteCreateInput) => Note
}

interface QuickNoteHandlerOptions {
  readonly onSaved?: (note: Note) => void
}

export interface QuickNoteHandlers {
  readonly open: () => AppResult<DesktopWindowState>
  readonly save: (request: unknown) => AppResult<Note>
  readonly respondToClose: (request: unknown) => EmptyResult
}

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

function parseQuickNoteSaveInput(
  request: unknown
): AppResult<QuickNoteSaveInput> {
  if (
    !isRecord(request) ||
    !hasOnlyFields(request, ['contentMarkdown', 'title']) ||
    typeof request.contentMarkdown !== 'string' ||
    (request.title !== undefined && typeof request.title !== 'string')
  ) {
    return validationFailure('The quick note save payload is invalid.')
  }

  if (request.contentMarkdown.trim().length === 0) {
    return validationFailure('Quick note content is required before saving.')
  }

  return success({
    contentMarkdown: request.contentMarkdown,
    title: request.title
  })
}

function parseCloseResponse(
  request: unknown
): AppResult<QuickNoteCloseResponseInput> {
  if (!isRecord(request) || typeof request.action !== 'string') {
    return validationFailure('The quick note close response is invalid.')
  }

  if (request.action === 'save') {
    if (!hasOnlyFields(request, ['action', 'draft'])) {
      return validationFailure('The quick note close response is invalid.')
    }

    const draft = parseQuickNoteSaveInput(request.draft)

    return draft.ok
      ? success({
          action: 'save',
          draft: draft.value
        })
      : draft
  }

  if (
    (request.action === 'discard' || request.action === 'cancel') &&
    hasOnlyFields(request, ['action'])
  ) {
    return success({
      action: request.action
    })
  }

  return validationFailure('The quick note close response is invalid.')
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

export function createQuickNoteHandlers(
  controller: QuickNoteWindowController,
  repository: NoteRepository,
  options: QuickNoteHandlerOptions = {}
): QuickNoteHandlers {
  function saveQuickNote(input: QuickNoteSaveInput): AppResult<Note> {
    return runDatabaseOperation(() => {
      const note = repository.create({
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        sourceType: 'quick-note'
      })

      options.onSaved?.(note)

      return success(note)
    })
  }

  return {
    open: () => {
      try {
        return success(controller.open())
      } catch {
        return failure('unknown', 'Unable to open the quick note window.')
      }
    },
    save: (request) => {
      const input = parseQuickNoteSaveInput(request)

      return input.ok ? saveQuickNote(input.value) : input
    },
    respondToClose: (request) => {
      const input = parseCloseResponse(request)

      if (!input.ok) {
        return input
      }

      if (input.value.action === 'save') {
        const saveResult = saveQuickNote(input.value.draft)

        if (!saveResult.ok) {
          return saveResult
        }
      }

      try {
        if (input.value.action === 'cancel') {
          controller.cancelCloseRequest()
        } else {
          controller.closeAfterResponse()
        }
      } catch {
        return failure('unknown', 'Unable to update the quick note window.')
      }

      return success(undefined)
    }
  }
}
