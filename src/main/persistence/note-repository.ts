import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import {
  DEFAULT_NOTE_TITLE,
  createNotePreviewText,
  deriveNoteTitle
} from '../../shared/note-content'
import {
  DEFAULT_NOTE_SOURCE_TYPE,
  NOTE_SOURCE_TYPES,
  type Note,
  type NoteCreateInput,
  type NoteId,
  type NoteSourceType,
  type NoteSummary,
  type NoteUpdateInput
} from '../../shared/notes'

export {
  DEFAULT_NOTE_TITLE,
  NOTE_PREVIEW_MAX_LENGTH,
  createNotePreviewText
} from '../../shared/note-content'

interface NoteRepositoryDependencies {
  readonly createId?: () => NoteId
  readonly now?: () => Date
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^```.*$/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[(?: |x|X)\]\s*/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1')
}

function normalizeTitle(title: string | undefined, contentMarkdown: string) {
  const normalizedTitle = title ? collapseWhitespace(stripMarkdown(title)) : ''

  return normalizedTitle || deriveNoteTitle(contentMarkdown)
}

function isNoteSourceType(value: unknown): value is NoteSourceType {
  return NOTE_SOURCE_TYPES.some((sourceType) => sourceType === value)
}

function readString(row: Record<string, unknown>, column: string): string {
  const value = row[column]

  if (typeof value !== 'string') {
    throw new Error(`Expected SQLite column "${column}" to contain text.`)
  }

  return value
}

function readPinned(row: Record<string, unknown>): boolean {
  const value = row.pinned

  if (value !== 0 && value !== 1) {
    throw new Error('Expected SQLite column "pinned" to contain 0 or 1.')
  }

  return value === 1
}

function readSourceType(row: Record<string, unknown>): NoteSourceType {
  const value = row.sourceType

  if (!isNoteSourceType(value)) {
    throw new Error(
      'Expected SQLite column "sourceType" to contain a valid value.'
    )
  }

  return value
}

function toNote(row: Record<string, unknown>): Note {
  return {
    id: readString(row, 'id'),
    title: readString(row, 'title'),
    contentMarkdown: readString(row, 'contentMarkdown'),
    previewText: readString(row, 'previewText'),
    createdAt: readString(row, 'createdAt'),
    updatedAt: readString(row, 'updatedAt'),
    pinned: readPinned(row),
    sourceType: readSourceType(row)
  }
}

function toNoteSummary(row: Record<string, unknown>): NoteSummary {
  return {
    id: readString(row, 'id'),
    title: readString(row, 'title'),
    previewText: readString(row, 'previewText'),
    updatedAt: readString(row, 'updatedAt'),
    pinned: readPinned(row),
    sourceType: readSourceType(row)
  }
}

export class NoteRepository {
  private readonly createId: () => NoteId
  private readonly now: () => Date

  public constructor(
    private readonly database: DatabaseSync,
    dependencies: NoteRepositoryDependencies = {}
  ) {
    this.createId = dependencies.createId ?? randomUUID
    this.now = dependencies.now ?? (() => new Date())
  }

  public create(input: NoteCreateInput = {}): Note {
    const id = this.createId()
    const contentMarkdown = input.contentMarkdown ?? ''
    const title = normalizeTitle(input.title, contentMarkdown)
    const previewText = createNotePreviewText(contentMarkdown)
    const timestamp = this.now().toISOString()
    const pinned = input.pinned ?? false
    const sourceType = input.sourceType ?? DEFAULT_NOTE_SOURCE_TYPE

    this.database
      .prepare(
        `
          INSERT INTO notes (
            id,
            title,
            content_markdown,
            preview_text,
            created_at,
            updated_at,
            pinned,
            source_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        id,
        title,
        contentMarkdown,
        previewText,
        timestamp,
        timestamp,
        Number(pinned),
        sourceType
      )

    return {
      id,
      title,
      contentMarkdown,
      previewText,
      createdAt: timestamp,
      updatedAt: timestamp,
      pinned,
      sourceType
    }
  }

  public list(): NoteSummary[] {
    return this.database
      .prepare(
        `
          SELECT
            id,
            title,
            preview_text AS previewText,
            updated_at AS updatedAt,
            pinned,
            source_type AS sourceType
          FROM notes
          ORDER BY updated_at DESC, created_at DESC, id DESC
        `
      )
      .all()
      .map(toNoteSummary)
  }

  public get(id: NoteId): Note | undefined {
    const row = this.database
      .prepare(
        `
          SELECT
            id,
            title,
            content_markdown AS contentMarkdown,
            preview_text AS previewText,
            created_at AS createdAt,
            updated_at AS updatedAt,
            pinned,
            source_type AS sourceType
          FROM notes
          WHERE id = ?
        `
      )
      .get(id)

    return row ? toNote(row) : undefined
  }

  public update(input: NoteUpdateInput): Note | undefined {
    const existingNote = this.get(input.id)

    if (!existingNote) {
      return undefined
    }

    const contentMarkdown =
      input.contentMarkdown ?? existingNote.contentMarkdown
    const title =
      input.title !== undefined
        ? normalizeTitle(input.title, contentMarkdown)
        : input.contentMarkdown !== undefined &&
            existingNote.title === DEFAULT_NOTE_TITLE
          ? deriveNoteTitle(contentMarkdown)
          : existingNote.title
    const previewText = createNotePreviewText(contentMarkdown)
    const updatedAt = this.now().toISOString()
    const pinned = input.pinned ?? existingNote.pinned

    this.database
      .prepare(
        `
          UPDATE notes
          SET
            title = ?,
            content_markdown = ?,
            preview_text = ?,
            updated_at = ?,
            pinned = ?
          WHERE id = ?
        `
      )
      .run(
        title,
        contentMarkdown,
        previewText,
        updatedAt,
        Number(pinned),
        input.id
      )

    return {
      ...existingNote,
      title,
      contentMarkdown,
      previewText,
      updatedAt,
      pinned
    }
  }

  public delete(id: NoteId): boolean {
    const result = this.database
      .prepare('DELETE FROM notes WHERE id = ?')
      .run(id)

    return result.changes === 1
  }
}
