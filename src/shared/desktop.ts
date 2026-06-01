export type DesktopWindowId = number

export const DESKTOP_WINDOW_KINDS = ['main', 'quick-note'] as const

export type DesktopWindowKind = (typeof DESKTOP_WINDOW_KINDS)[number]

export interface DesktopWindowState {
  readonly id: DesktopWindowId
  readonly kind: DesktopWindowKind
  readonly alwaysOnTop: boolean
}

export interface SetAlwaysOnTopInput {
  readonly enabled: boolean
}
