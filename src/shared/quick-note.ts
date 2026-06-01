import type { DesktopWindowId } from './desktop'

export const QUICK_NOTE_CLOSE_ACTIONS = ['save', 'discard', 'cancel'] as const

export type QuickNoteCloseAction = (typeof QUICK_NOTE_CLOSE_ACTIONS)[number]

export interface QuickNoteDraft {
  readonly contentMarkdown: string
  readonly alwaysOnTop: boolean
}

export interface QuickNoteSaveInput {
  readonly contentMarkdown: string
  readonly title?: string
}

export interface QuickNoteCloseRequest {
  readonly windowId: DesktopWindowId
}

export type QuickNoteCloseResponseInput =
  | {
      readonly action: 'save'
      readonly draft: QuickNoteSaveInput
    }
  | {
      readonly action: 'discard' | 'cancel'
    }
