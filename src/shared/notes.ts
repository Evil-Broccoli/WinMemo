export const NOTE_SOURCE_TYPES = ['note', 'imported', 'quick-note'] as const

export const DEFAULT_NOTE_SOURCE_TYPE = 'note' satisfies NoteSourceType

export type NoteId = string

export type IsoDateTimeString = string

export type NoteSourceType = (typeof NOTE_SOURCE_TYPES)[number]

export interface Note {
  readonly id: NoteId
  readonly title: string
  readonly contentMarkdown: string
  readonly previewText: string
  readonly createdAt: IsoDateTimeString
  readonly updatedAt: IsoDateTimeString
  readonly pinned: boolean
  readonly sourceType: NoteSourceType
}

export interface NoteSummary {
  readonly id: NoteId
  readonly title: string
  readonly previewText: string
  readonly updatedAt: IsoDateTimeString
  readonly pinned: boolean
  readonly sourceType: NoteSourceType
}

export interface NoteCreateInput {
  readonly title?: string
  readonly contentMarkdown?: string
  readonly pinned?: boolean
  readonly sourceType?: NoteSourceType
}

interface NoteMutableFields {
  readonly title: string
  readonly contentMarkdown: string
  readonly pinned: boolean
}

type AtLeastOne<T> = {
  [Key in keyof T]: Pick<T, Key> & Partial<Omit<T, Key>>
}[keyof T]

export type NoteUpdateInput = Readonly<
  {
    id: NoteId
  } & AtLeastOne<NoteMutableFields>
>
