import { ipcMain } from 'electron'
import { IPC_INVOKE_CHANNELS } from '../../shared/ipc'
import type { NoteRepository } from '../persistence/note-repository'
import { createNoteHandlers } from './note-handlers'

export function registerNoteIpcHandlers(
  repository: NoteRepository
): () => void {
  const handlers = createNoteHandlers(repository)
  const channels = IPC_INVOKE_CHANNELS.notes

  ipcMain.handle(channels.list, () => handlers.list())
  ipcMain.handle(channels.get, (_event, request: unknown) =>
    handlers.get(request)
  )
  ipcMain.handle(channels.create, (_event, request: unknown) =>
    handlers.create(request)
  )
  ipcMain.handle(channels.update, (_event, request: unknown) =>
    handlers.update(request)
  )
  ipcMain.handle(channels.delete, (_event, request: unknown) =>
    handlers.delete(request)
  )

  return () => {
    ipcMain.removeHandler(channels.list)
    ipcMain.removeHandler(channels.get)
    ipcMain.removeHandler(channels.create)
    ipcMain.removeHandler(channels.update)
    ipcMain.removeHandler(channels.delete)
  }
}
