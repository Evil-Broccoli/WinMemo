import { ipcMain } from 'electron'
import { IPC_INVOKE_CHANNELS } from '../../shared/ipc'
import type { Note } from '../../shared/notes'
import type { NoteRepository } from '../persistence/note-repository'
import { createQuickNoteHandlers } from './quick-note-handlers'
import type { QuickNoteWindowManager } from './quick-note-window'

export function registerQuickNoteIpcHandlers(
  quickNoteWindow: QuickNoteWindowManager,
  repository: NoteRepository,
  options: {
    readonly onSaved?: (note: Note) => void
  } = {}
): () => void {
  const handlers = createQuickNoteHandlers(quickNoteWindow, repository, options)
  const channels = IPC_INVOKE_CHANNELS.quickNote

  ipcMain.handle(channels.open, () => handlers.open())
  ipcMain.handle(channels.save, (_event, request: unknown) =>
    handlers.save(request)
  )
  ipcMain.handle(channels.respondToClose, (_event, request: unknown) =>
    handlers.respondToClose(request)
  )

  return () => {
    ipcMain.removeHandler(channels.open)
    ipcMain.removeHandler(channels.save)
    ipcMain.removeHandler(channels.respondToClose)
  }
}
