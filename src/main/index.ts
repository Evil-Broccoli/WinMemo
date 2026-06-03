import { join } from 'node:path'
import { app, BrowserWindow, globalShortcut, shell } from 'electron'
import { APP_NAME } from '@shared/constants'
import { IPC_EVENT_CHANNELS } from '@shared/ipc'
import type { Note, NoteSummary } from '@shared/notes'
import { initializeAssetStorage } from './assets/asset-storage'
import { registerAssetIpcHandlers } from './assets/register-asset-ipc'
import {
  registerAssetProtocolHandler,
  registerAssetProtocolScheme
} from './assets/register-asset-protocol'
import { registerNoteIpcHandlers } from './notes/register-note-ipc'
import {
  closeDatabase,
  getDatabasePath,
  initializeDatabase
} from './persistence/database'
import { NoteRepository } from './persistence/note-repository'
import { registerQuickNoteGlobalShortcut } from './shortcuts/global-shortcut'
import { registerQuickNoteIpcHandlers } from './windows/register-quick-note-ipc'
import { createQuickNoteWindowManager } from './windows/quick-note-window'
import { createDesktopWindowRegistry } from './windows/window-registry'
import { registerWindowIpcHandlers } from './windows/register-window-ipc'
import type { DesktopWindowRegistry } from './windows/window-registry'

let disposeAssetIpcHandlers: (() => void) | undefined
let disposeAssetProtocolHandler: (() => void) | undefined
let disposeNoteIpcHandlers: (() => void) | undefined
let disposeQuickNoteIpcHandlers: (() => void) | undefined
let disposeQuickNoteGlobalShortcut: (() => void) | undefined
let disposeQuickNoteWindow: (() => void) | undefined
let disposeWindowIpcHandlers: (() => void) | undefined

registerAssetProtocolScheme()

function createMainWindow(registry: DesktopWindowRegistry): BrowserWindow {
  const mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 1120,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    show: false,
    backgroundColor: '#f4f5f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  registry.register(mainWindow, 'main')

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      void shell.openExternal(url)
    }

    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function toNoteSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    previewText: note.previewText,
    updatedAt: note.updatedAt,
    pinned: note.pinned,
    sourceType: note.sourceType
  }
}

function notifyMainWindowsOfNoteChange(
  registry: DesktopWindowRegistry,
  note: Note
): void {
  const summary = toNoteSummary(note)

  for (const window of BrowserWindow.getAllWindows()) {
    if (
      registry.getKind(window) === 'main' &&
      !window.webContents.isDestroyed()
    ) {
      window.webContents.send(IPC_EVENT_CHANNELS.notes.changed, summary)
    }
  }
}

app.whenReady().then(() => {
  const userDataPath =
    process.env.WINDOWS_MEMO_USER_DATA_PATH ?? app.getPath('userData')

  const database = initializeDatabase(getDatabasePath(userDataPath))
  const assetStorage = initializeAssetStorage(userDataPath)
  const noteRepository = new NoteRepository(database)
  const windowRegistry = createDesktopWindowRegistry()
  const quickNoteWindow = createQuickNoteWindowManager({
    preloadScriptPath: join(__dirname, '../preload/index.cjs'),
    rendererUrl: process.env.ELECTRON_RENDERER_URL,
    rendererFilePath: join(__dirname, '../renderer/quick-note.html'),
    registerWindow: windowRegistry.register
  })

  disposeAssetIpcHandlers = registerAssetIpcHandlers(assetStorage)
  disposeAssetProtocolHandler = registerAssetProtocolHandler(assetStorage)
  disposeNoteIpcHandlers = registerNoteIpcHandlers(noteRepository)
  disposeQuickNoteIpcHandlers = registerQuickNoteIpcHandlers(
    quickNoteWindow,
    noteRepository,
    {
      onSaved: (note) => notifyMainWindowsOfNoteChange(windowRegistry, note)
    }
  )
  disposeWindowIpcHandlers = registerWindowIpcHandlers({
    registry: windowRegistry,
    onAlwaysOnTopChanged: (state) => {
      if (state.kind === 'quick-note') {
        quickNoteWindow.rememberAlwaysOnTop(state.alwaysOnTop)
      }
    }
  })
  disposeQuickNoteGlobalShortcut = registerQuickNoteGlobalShortcut({
    registrar: globalShortcut,
    quickNoteWindow
  }).dispose
  disposeQuickNoteWindow = quickNoteWindow.dispose
  createMainWindow(windowRegistry)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(windowRegistry)
    }
  })
})

app.on('will-quit', () => {
  disposeAssetIpcHandlers?.()
  disposeAssetProtocolHandler?.()
  disposeNoteIpcHandlers?.()
  disposeQuickNoteIpcHandlers?.()
  disposeQuickNoteGlobalShortcut?.()
  disposeWindowIpcHandlers?.()
  disposeQuickNoteWindow?.()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
