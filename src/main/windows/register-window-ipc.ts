import { BrowserWindow, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { IPC_INVOKE_CHANNELS } from '../../shared/ipc'
import { createWindowHandlers } from './window-handlers'
import type { DesktopWindowRegistry } from './window-registry'

interface RegisterWindowIpcOptions {
  readonly registry: DesktopWindowRegistry
  readonly onAlwaysOnTopChanged?: Parameters<
    typeof createWindowHandlers
  >[0]['onAlwaysOnTopChanged']
}

function getSenderWindow(event: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined
}

export function registerWindowIpcHandlers(
  options: RegisterWindowIpcOptions
): () => void {
  const handlers = createWindowHandlers({
    getKind: options.registry.getKind,
    onAlwaysOnTopChanged: options.onAlwaysOnTopChanged
  })
  const channels = IPC_INVOKE_CHANNELS.window

  ipcMain.handle(channels.getState, (event) =>
    handlers.getState(getSenderWindow(event))
  )
  ipcMain.handle(channels.setAlwaysOnTop, (event, request: unknown) =>
    handlers.setAlwaysOnTop(getSenderWindow(event), request)
  )

  return () => {
    ipcMain.removeHandler(channels.getState)
    ipcMain.removeHandler(channels.setAlwaysOnTop)
  }
}
