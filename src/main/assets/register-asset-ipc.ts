import { ipcMain } from 'electron'
import { IPC_INVOKE_CHANNELS } from '../../shared/ipc'
import type { AssetStorageService } from './asset-storage'
import { createAssetHandlers } from './asset-handlers'

export function registerAssetIpcHandlers(
  storage: AssetStorageService
): () => void {
  const handlers = createAssetHandlers(storage)
  const channel = IPC_INVOKE_CHANNELS.assets.saveImage

  ipcMain.handle(channel, (_event, request: unknown) =>
    handlers.saveImage(request)
  )

  return () => {
    ipcMain.removeHandler(channel)
  }
}
