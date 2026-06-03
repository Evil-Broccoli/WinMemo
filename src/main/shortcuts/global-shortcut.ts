import type { DesktopWindowState } from '../../shared/desktop'

export const QUICK_NOTE_SHORTCUT_ACCELERATORS = [
  'CommandOrControl+Shift+M',
  'CommandOrControl+Alt+M'
] as const

export interface GlobalShortcutRegistrar {
  readonly register: (accelerator: string, callback: () => void) => boolean
  readonly unregister: (accelerator: string) => void
}

interface QuickNoteShortcutWindow {
  readonly open: () => DesktopWindowState
}

interface QuickNoteShortcutLogger {
  readonly warn: (message: string) => void
}

interface QuickNoteShortcutOptions {
  readonly registrar: GlobalShortcutRegistrar
  readonly quickNoteWindow: QuickNoteShortcutWindow
  readonly accelerators?: readonly string[]
  readonly logger?: QuickNoteShortcutLogger
}

export interface QuickNoteShortcutRegistration {
  readonly registered: boolean
  readonly accelerator?: string
  readonly dispose: () => void
}

function createOpenQuickNoteCallback(
  quickNoteWindow: QuickNoteShortcutWindow,
  logger: QuickNoteShortcutLogger
): () => void {
  return () => {
    try {
      quickNoteWindow.open()
    } catch {
      logger.warn('Unable to open the quick note window from the shortcut.')
    }
  }
}

export function registerQuickNoteGlobalShortcut(
  options: QuickNoteShortcutOptions
): QuickNoteShortcutRegistration {
  const logger = options.logger ?? console
  const accelerators = options.accelerators ?? QUICK_NOTE_SHORTCUT_ACCELERATORS
  const callback = createOpenQuickNoteCallback(options.quickNoteWindow, logger)

  for (const accelerator of accelerators) {
    try {
      if (options.registrar.register(accelerator, callback)) {
        return {
          registered: true,
          accelerator,
          dispose: () => options.registrar.unregister(accelerator)
        }
      }

      logger.warn(`Quick note shortcut "${accelerator}" is unavailable.`)
    } catch {
      logger.warn(
        `Quick note shortcut "${accelerator}" could not be registered.`
      )
    }
  }

  logger.warn(
    'Quick note global shortcut registration failed. Use the Quick note button to open quick capture.'
  )

  return {
    registered: false,
    dispose: () => undefined
  }
}
