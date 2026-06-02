import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { APP_NAME } from '@shared/constants'
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

let disposeAssetIpcHandlers: (() => void) | undefined
let disposeAssetProtocolHandler: (() => void) | undefined
let disposeNoteIpcHandlers: (() => void) | undefined

registerAssetProtocolScheme()

function createMainWindow(): BrowserWindow {
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

app.whenReady().then(() => {
  const userDataPath =
    process.env.WINDOWS_MEMO_USER_DATA_PATH ?? app.getPath('userData')

  const database = initializeDatabase(getDatabasePath(userDataPath))
  const assetStorage = initializeAssetStorage(userDataPath)
  disposeAssetIpcHandlers = registerAssetIpcHandlers(assetStorage)
  disposeAssetProtocolHandler = registerAssetProtocolHandler(assetStorage)
  disposeNoteIpcHandlers = registerNoteIpcHandlers(new NoteRepository(database))
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('will-quit', () => {
  disposeAssetIpcHandlers?.()
  disposeAssetProtocolHandler?.()
  disposeNoteIpcHandlers?.()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
