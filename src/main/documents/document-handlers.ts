import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { DOCUMENT_FORMATS, LEGACY_WORD_FORMAT } from '../../shared/documents'
import type {
  ExportFormat,
  ExportNoteInput,
  ExportNoteResult,
  ImportFileSelection,
  ImportFormat,
  ImportNotesResult
} from '../../shared/documents'
import type {
  Note,
  NoteCreateInput,
  NoteId,
  NoteSummary
} from '../../shared/notes'
import type { AppErrorCode, AppResult } from '../../shared/result'
import { createDocxMarkdownImporter } from './docx-import'
import type { DocxMarkdownImporter } from './docx-import'

export interface ExportDialogInput {
  readonly note: Note
  readonly format: ExportFormat
}

export interface DocumentDialog {
  readonly showImportFilePicker?: () => Promise<readonly string[] | undefined>
  readonly showExportFilePicker?: (
    input: ExportDialogInput
  ) => Promise<string | undefined>
}

export interface DocumentNoteRepository {
  readonly create: (input: NoteCreateInput) => Note
  readonly get: (id: NoteId) => Note | undefined
}

export interface ExportNoteFileInput {
  readonly note: Note
  readonly filePath: string
  readonly format: ExportFormat
}

export type ExportNoteFile = (
  input: ExportNoteFileInput
) => Promise<ExportNoteResult>

interface DocumentHandlersDependencies {
  readonly dialog: DocumentDialog
  readonly repository: DocumentNoteRepository
  readonly readTextFile?: (filePath: string) => Promise<string>
  readonly importDocxFile?: DocxMarkdownImporter
  readonly exportNoteFile?: ExportNoteFile
}

export interface DocumentHandlers {
  readonly importNotes: () => Promise<AppResult<ImportNotesResult>>
  readonly exportNote: (
    request: unknown
  ) => Promise<AppResult<ExportNoteResult>>
}

const SUPPORTED_DOCUMENT_FORMATS = new Set<string>(DOCUMENT_FORMATS)
const EXPORT_NOTE_INPUT_FIELDS = ['noteId', 'format']
const NOTE_ID_MAX_LENGTH = 256

interface SelectedImportFile extends ImportFileSelection {
  readonly filePath: string
}

interface SelectedExportFile {
  readonly filePath: string
  readonly format: ExportFormat
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

function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === 'string' && SUPPORTED_DOCUMENT_FORMATS.has(value)
}

function parseNoteId(value: unknown): AppResult<NoteId> {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > NOTE_ID_MAX_LENGTH
  ) {
    return validationFailure('A valid note id is required for export.')
  }

  return success(value)
}

function parseExportNoteInput(request: unknown): AppResult<ExportNoteInput> {
  if (!isRecord(request) || !hasOnlyFields(request, EXPORT_NOTE_INPUT_FIELDS)) {
    return validationFailure('The export request payload is invalid.')
  }

  const noteId = parseNoteId(request.noteId)

  if (!noteId.ok) {
    return noteId
  }

  if (!isExportFormat(request.format)) {
    return validationFailure('A supported export format is required.')
  }

  return success({
    noteId: noteId.value,
    format: request.format
  })
}

function getImportFormat(filePath: string): ImportFormat | undefined {
  const extension = extname(filePath).slice(1).toLowerCase()

  return SUPPORTED_DOCUMENT_FORMATS.has(extension)
    ? (extension as ImportFormat)
    : undefined
}

function getExportFormat(filePath: string): ExportFormat | undefined {
  const extension = extname(filePath).slice(1).toLowerCase()

  return SUPPORTED_DOCUMENT_FORMATS.has(extension)
    ? (extension as ExportFormat)
    : undefined
}

function getUnsupportedImportMessage(filePath: string): string {
  const extension = extname(filePath).slice(1).toLowerCase()

  if (extension === LEGACY_WORD_FORMAT) {
    return 'Legacy .doc files are not supported. Please convert the file to .docx and import it again.'
  }

  return 'Windows Memo can import .txt, .md, and .docx files.'
}

function getUnsupportedExportMessage(filePath: string): string {
  const extension = extname(filePath).slice(1).toLowerCase()

  if (extension === LEGACY_WORD_FORMAT) {
    return 'Legacy .doc files are not supported. Export as .docx instead.'
  }

  return 'Windows Memo can export .txt, .md, and .docx files.'
}

function toImportFileSelection(
  filePath: string
): AppResult<SelectedImportFile> {
  const format = getImportFormat(filePath)

  if (!format) {
    return failure('unsupported-format', getUnsupportedImportMessage(filePath))
  }

  return success({
    filePath,
    fileName: basename(filePath),
    format
  })
}

function toExportFileSelection(
  filePath: string,
  defaultFormat: ExportFormat
): AppResult<SelectedExportFile> {
  const normalizedFilePath = filePath.replace(/[.]+$/u, '')
  const format = getExportFormat(normalizedFilePath)

  if (format) {
    return success({
      filePath: normalizedFilePath,
      format
    })
  }

  if (extname(normalizedFilePath).length > 0) {
    return failure('unsupported-format', getUnsupportedExportMessage(filePath))
  }

  return success({
    filePath: `${normalizedFilePath}.${defaultFormat}`,
    format: defaultFormat
  })
}

function toNoteSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    previewText: note.previewText,
    updatedAt: note.updatedAt,
    pinned: note.pinned,
    sourceType: note.sourceType
  }
}

function isTextImportFormat(format: ImportFormat): boolean {
  return format === 'txt' || format === 'md'
}

async function readUtf8TextFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8')
}

function removeUtf8ByteOrderMark(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

async function readImportFileContent(
  file: SelectedImportFile,
  readTextFile: (filePath: string) => Promise<string>,
  importDocxFile: DocxMarkdownImporter
): Promise<string> {
  if (isTextImportFormat(file.format)) {
    return removeUtf8ByteOrderMark(await readTextFile(file.filePath))
  }

  return importDocxFile(file.filePath, file.fileName)
}

async function markExportDestinationSelected({
  filePath,
  format
}: ExportNoteFileInput): Promise<ExportNoteResult> {
  return {
    status: 'selected',
    filePath,
    format
  }
}

export function createDocumentHandlers({
  dialog,
  repository,
  readTextFile = readUtf8TextFile,
  importDocxFile = createDocxMarkdownImporter(),
  exportNoteFile = markExportDestinationSelected
}: DocumentHandlersDependencies): DocumentHandlers {
  return {
    importNotes: async () => {
      try {
        if (!dialog.showImportFilePicker) {
          return failure('unknown', 'Unable to open the import file picker.')
        }

        const filePaths = await dialog.showImportFilePicker()

        if (!filePaths || filePaths.length === 0) {
          return success({ status: 'cancelled' })
        }

        const files: SelectedImportFile[] = []

        for (const filePath of filePaths) {
          const selection = toImportFileSelection(filePath)

          if (!selection.ok) {
            return selection
          }

          files.push(selection.value)
        }

        const notes: NoteSummary[] = []

        for (const file of files) {
          let contentMarkdown: string

          try {
            contentMarkdown = await readImportFileContent(
              file,
              readTextFile,
              importDocxFile
            )
          } catch {
            return failure(
              'file-read-failed',
              `Unable to read ${file.fileName}.`
            )
          }

          try {
            notes.push(
              toNoteSummary(
                repository.create({
                  contentMarkdown,
                  sourceType: 'imported'
                })
              )
            )
          } catch {
            return failure(
              'database-failed',
              'Unable to save imported notes to the local database.'
            )
          }
        }

        return success({
          status: 'imported',
          notes
        })
      } catch {
        return failure('unknown', 'Unable to open the import file picker.')
      }
    },
    exportNote: async (request) => {
      const input = parseExportNoteInput(request)

      if (!input.ok) {
        return input
      }

      let note: Note | undefined

      try {
        note = repository.get(input.value.noteId)
      } catch {
        return failure(
          'database-failed',
          'Unable to load the selected note for export.'
        )
      }

      if (!note) {
        return failure('not-found', 'The selected note was not found.')
      }

      try {
        if (!dialog.showExportFilePicker) {
          return failure('unknown', 'Unable to open the export save dialog.')
        }

        const filePath = await dialog.showExportFilePicker({
          note,
          format: input.value.format
        })

        if (!filePath) {
          return success({ status: 'cancelled' })
        }

        const selection = toExportFileSelection(filePath, input.value.format)

        if (!selection.ok) {
          return selection
        }

        try {
          return success(
            await exportNoteFile({
              note,
              filePath: selection.value.filePath,
              format: selection.value.format
            })
          )
        } catch {
          return failure(
            'file-write-failed',
            'Unable to export the selected note.'
          )
        }
      } catch {
        return failure('unknown', 'Unable to open the export save dialog.')
      }
    }
  }
}
