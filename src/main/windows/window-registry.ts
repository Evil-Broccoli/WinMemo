import type { BrowserWindow } from 'electron'
import type { DesktopWindowKind } from '../../shared/desktop'

export interface DesktopWindowRegistry {
  readonly register: (window: BrowserWindow, kind: DesktopWindowKind) => void
  readonly getKind: (
    window: Pick<BrowserWindow, 'id'>
  ) => DesktopWindowKind | undefined
}

export function createDesktopWindowRegistry(): DesktopWindowRegistry {
  const windowKinds = new Map<number, DesktopWindowKind>()

  return {
    register: (window, kind) => {
      windowKinds.set(window.id, kind)
      window.once('closed', () => {
        windowKinds.delete(window.id)
      })
    },
    getKind: (window) => windowKinds.get(window.id)
  }
}
