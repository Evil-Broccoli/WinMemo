import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC_EVENT_CHANNELS, IPC_INVOKE_CHANNELS } from '@shared/ipc'
import type {
  DesktopBridge,
  IpcInvokeChannel,
  IpcInvokeRequest,
  IpcInvokeResponse
} from '@shared/ipc'

type InvokeArguments<Channel extends IpcInvokeChannel> =
  IpcInvokeRequest<Channel> extends undefined
    ? []
    : [request: IpcInvokeRequest<Channel>]

function invoke<Channel extends IpcInvokeChannel>(
  channel: Channel,
  ...args: InvokeArguments<Channel>
): Promise<IpcInvokeResponse<Channel>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<
    IpcInvokeResponse<Channel>
  >
}

const desktopBridge = {
  platform: process.platform,
  notes: {
    list: () => invoke(IPC_INVOKE_CHANNELS.notes.list),
    get: (id) => invoke(IPC_INVOKE_CHANNELS.notes.get, { id }),
    create: (input = {}) => invoke(IPC_INVOKE_CHANNELS.notes.create, input),
    update: (input) => invoke(IPC_INVOKE_CHANNELS.notes.update, input),
    delete: (id) => invoke(IPC_INVOKE_CHANNELS.notes.delete, { id })
  },
  documents: {
    importNotes: () => invoke(IPC_INVOKE_CHANNELS.documents.importNotes),
    exportNote: (input) =>
      invoke(IPC_INVOKE_CHANNELS.documents.exportNote, input)
  },
  assets: {
    saveImage: (input) => invoke(IPC_INVOKE_CHANNELS.assets.saveImage, input)
  },
  quickNote: {
    open: () => invoke(IPC_INVOKE_CHANNELS.quickNote.open),
    save: (input) => invoke(IPC_INVOKE_CHANNELS.quickNote.save, input),
    respondToClose: (input) =>
      invoke(IPC_INVOKE_CHANNELS.quickNote.respondToClose, input),
    onCloseRequested: (listener) => {
      const handleCloseRequested = (
        _event: IpcRendererEvent,
        request: Parameters<typeof listener>[0]
      ): void => {
        listener(request)
      }

      ipcRenderer.on(
        IPC_EVENT_CHANNELS.quickNote.closeRequested,
        handleCloseRequested
      )

      return () => {
        ipcRenderer.removeListener(
          IPC_EVENT_CHANNELS.quickNote.closeRequested,
          handleCloseRequested
        )
      }
    }
  },
  window: {
    getState: () => invoke(IPC_INVOKE_CHANNELS.window.getState),
    setAlwaysOnTop: (enabled) =>
      invoke(IPC_INVOKE_CHANNELS.window.setAlwaysOnTop, { enabled })
  }
} satisfies DesktopBridge

contextBridge.exposeInMainWorld('desktop', desktopBridge)
