import type { NoteId, NoteSummary } from './notes'

export const DOCUMENT_FORMATS = ['txt', 'md', 'docx'] as const

export const LEGACY_WORD_FORMAT = 'doc' as const

export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number]

export type ImportFormat = DocumentFormat

export type ExportFormat = DocumentFormat

export interface ImportFileSelection {
  readonly fileName: string
  readonly format: ImportFormat
}

export type ImportNotesResult =
  | {
      readonly status: 'cancelled'
    }
  | {
      readonly status: 'selected'
      readonly files: readonly ImportFileSelection[]
    }
  | {
      readonly status: 'imported'
      readonly notes: readonly NoteSummary[]
    }

export interface ExportNoteInput {
  readonly noteId: NoteId
  readonly format: ExportFormat
}

export type ExportNoteResult =
  | {
      readonly status: 'cancelled'
    }
  | {
      readonly status: 'selected'
      readonly filePath: string
      readonly format: ExportFormat
    }
  | {
      readonly status: 'exported'
      readonly filePath: string
      readonly format: ExportFormat
    }
