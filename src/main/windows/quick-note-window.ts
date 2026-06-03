import { BrowserWindow, screen, shell } from 'electron'
import { APP_NAME } from '../../shared/constants'
import { IPC_EVENT_CHANNELS } from '../../shared/ipc'
import type { DesktopWindowKind } from '../../shared/desktop'
import type { DesktopWindowState } from '../../shared/desktop'

export interface QuickNoteWindowManager {
  readonly open: () => DesktopWindowState
  readonly closeAfterResponse: () => void
  readonly cancelCloseRequest: () => void
  readonly rememberAlwaysOnTop: (enabled: boolean) => void
  readonly dispose: () => void
}

interface QuickNoteWindowManagerOptions {
  readonly preloadScriptPath: string
  readonly rendererUrl?: string
  readonly rendererFilePath: string
  readonly registerWindow: (
    window: BrowserWindow,
    kind: DesktopWindowKind
  ) => void
}

const QUICK_NOTE_WIDTH = 360
const QUICK_NOTE_HEIGHT = 430
const QUICK_NOTE_MARGIN = 24
const QUICK_NOTE_OPACITY = 0.96

function getDesktopWindowState(window: BrowserWindow): DesktopWindowState {
  return {
    id: window.id,
    kind: 'quick-note',
    alwaysOnTop: window.isAlwaysOnTop()
  }
}

function getQuickNoteDevUrl(rendererUrl: string): string {
  const baseUrl = rendererUrl.endsWith('/') ? rendererUrl : `${rendererUrl}/`

  return new URL('quick-note.html', baseUrl).toString()
}

function getQuickNoteBounds(): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay()

  return {
    width: QUICK_NOTE_WIDTH,
    height: QUICK_NOTE_HEIGHT,
    x: Math.max(
      workArea.x,
      workArea.x + workArea.width - QUICK_NOTE_WIDTH - QUICK_NOTE_MARGIN
    ),
    y: workArea.y + QUICK_NOTE_MARGIN
  }
}

function loadQuickNoteRenderer(
  window: BrowserWindow,
  options: QuickNoteWindowManagerOptions
): void {
  if (options.rendererUrl) {
    void window.loadURL(getQuickNoteDevUrl(options.rendererUrl))
    return
  }

  void window.loadFile(options.rendererFilePath)
}

export function createQuickNoteWindowManager(
  options: QuickNoteWindowManagerOptions
): QuickNoteWindowManager {
  let quickNoteWindow: BrowserWindow | undefined
  let preferredAlwaysOnTop = false
  let canCloseWindow = false
  let isCloseRequestPending = false

  function sendCloseRequest(window: BrowserWindow): void {
    if (isCloseRequestPending || window.webContents.isDestroyed()) {
      return
    }

    isCloseRequestPending = true
    window.webContents.send(IPC_EVENT_CHANNELS.quickNote.closeRequested, {
      windowId: window.id
    })
  }

  function createWindow(): BrowserWindow {
    const bounds = getQuickNoteBounds()
    const window = new BrowserWindow({
      title: `Quick note - ${APP_NAME}`,
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      minWidth: 320,
      minHeight: 280,
      show: false,
      frame: false,
      transparent: true,
      hasShadow: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: options.preloadScriptPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    window.setOpacity(QUICK_NOTE_OPACITY)
    window.setAlwaysOnTop(preferredAlwaysOnTop)
    options.registerWindow(window, 'quick-note')

    window.on('close', (event) => {
      if (canCloseWindow) {
        return
      }

      event.preventDefault()
      sendCloseRequest(window)
    })

    window.once('ready-to-show', () => {
      window.show()
      window.focus()
    })

    window.on('closed', () => {
      if (quickNoteWindow === window) {
        quickNoteWindow = undefined
      }

      canCloseWindow = false
      isCloseRequestPending = false
    })

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) {
        void shell.openExternal(url)
      }

      return { action: 'deny' }
    })

    loadQuickNoteRenderer(window, options)

    return window
  }

  return {
    open: () => {
      if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
        if (quickNoteWindow.isMinimized()) {
          quickNoteWindow.restore()
        }

        quickNoteWindow.show()
        quickNoteWindow.focus()

        return getDesktopWindowState(quickNoteWindow)
      }

      quickNoteWindow = createWindow()

      return getDesktopWindowState(quickNoteWindow)
    },
    closeAfterResponse: () => {
      if (!quickNoteWindow || quickNoteWindow.isDestroyed()) {
        return
      }

      canCloseWindow = true
      isCloseRequestPending = false
      quickNoteWindow.close()
    },
    cancelCloseRequest: () => {
      isCloseRequestPending = false

      if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
        quickNoteWindow.show()
        quickNoteWindow.focus()
      }
    },
    rememberAlwaysOnTop: (enabled) => {
      preferredAlwaysOnTop = enabled
    },
    dispose: () => {
      if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
        canCloseWindow = true
        quickNoteWindow.close()
      }

      quickNoteWindow = undefined
    }
  }
}
