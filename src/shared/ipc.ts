import type { SaveImageAssetInput, AssetReference } from './assets'
import type { DesktopWindowState, SetAlwaysOnTopInput } from './desktop'
import type {
  ExportNoteInput,
  ExportNoteResult,
  ImportNotesResult
} from './documents'
import type {
  Note,
  NoteCreateInput,
  NoteId,
  NoteSummary,
  NoteUpdateInput
} from './notes'
import type {
  QuickNoteCloseRequest,
  QuickNoteCloseResponseInput,
  QuickNoteSaveInput
} from './quick-note'
import type { AppResult, EmptyResult } from './result'

export const IPC_INVOKE_CHANNELS = {
  notes: {
    list: 'notes:list',
    get: 'notes:get',
    create: 'notes:create',
    update: 'notes:update',
    delete: 'notes:delete'
  },
  documents: {
    importNotes: 'documents:import-notes',
    exportNote: 'documents:export-note'
  },
  assets: {
    saveImage: 'assets:save-image'
  },
  quickNote: {
    open: 'quick-note:open',
    save: 'quick-note:save',
    respondToClose: 'quick-note:respond-to-close'
  },
  window: {
    getState: 'window:get-state',
    setAlwaysOnTop: 'window:set-always-on-top'
  }
} as const

export const IPC_EVENT_CHANNELS = {
  quickNote: {
    closeRequested: 'quick-note:close-requested'
  }
} as const

export interface IpcInvokeChannelMap {
  'notes:list': {
    readonly request: undefined
    readonly response: AppResult<readonly NoteSummary[]>
  }
  'notes:get': {
    readonly request: Pick<Note, 'id'>
    readonly response: AppResult<Note>
  }
  'notes:create': {
    readonly request: NoteCreateInput
    readonly response: AppResult<Note>
  }
  'notes:update': {
    readonly request: NoteUpdateInput
    readonly response: AppResult<Note>
  }
  'notes:delete': {
    readonly request: Pick<Note, 'id'>
    readonly response: EmptyResult
  }
  'documents:import-notes': {
    readonly request: undefined
    readonly response: AppResult<ImportNotesResult>
  }
  'documents:export-note': {
    readonly request: ExportNoteInput
    readonly response: AppResult<ExportNoteResult>
  }
  'assets:save-image': {
    readonly request: SaveImageAssetInput
    readonly response: AppResult<AssetReference>
  }
  'quick-note:open': {
    readonly request: undefined
    readonly response: AppResult<DesktopWindowState>
  }
  'quick-note:save': {
    readonly request: QuickNoteSaveInput
    readonly response: AppResult<Note>
  }
  'quick-note:respond-to-close': {
    readonly request: QuickNoteCloseResponseInput
    readonly response: EmptyResult
  }
  'window:get-state': {
    readonly request: undefined
    readonly response: AppResult<DesktopWindowState>
  }
  'window:set-always-on-top': {
    readonly request: SetAlwaysOnTopInput
    readonly response: AppResult<DesktopWindowState>
  }
}

export interface IpcEventChannelMap {
  'quick-note:close-requested': QuickNoteCloseRequest
}

export type IpcInvokeChannel = keyof IpcInvokeChannelMap

export type IpcEventChannel = keyof IpcEventChannelMap

export type IpcInvokeRequest<Channel extends IpcInvokeChannel> =
  IpcInvokeChannelMap[Channel]['request']

export type IpcInvokeResponse<Channel extends IpcInvokeChannel> =
  IpcInvokeChannelMap[Channel]['response']

export type IpcEventPayload<Channel extends IpcEventChannel> =
  IpcEventChannelMap[Channel]

export type Unsubscribe = () => void

export interface DesktopBridge {
  readonly platform: string
  readonly notes: {
    readonly list: () => Promise<IpcInvokeResponse<'notes:list'>>
    readonly get: (id: NoteId) => Promise<IpcInvokeResponse<'notes:get'>>
    readonly create: (
      input?: NoteCreateInput
    ) => Promise<IpcInvokeResponse<'notes:create'>>
    readonly update: (
      input: NoteUpdateInput
    ) => Promise<IpcInvokeResponse<'notes:update'>>
    readonly delete: (id: NoteId) => Promise<IpcInvokeResponse<'notes:delete'>>
  }
  readonly documents: {
    readonly importNotes: () => Promise<
      IpcInvokeResponse<'documents:import-notes'>
    >
    readonly exportNote: (
      input: ExportNoteInput
    ) => Promise<IpcInvokeResponse<'documents:export-note'>>
  }
  readonly assets: {
    readonly saveImage: (
      input: SaveImageAssetInput
    ) => Promise<IpcInvokeResponse<'assets:save-image'>>
  }
  readonly quickNote: {
    readonly open: () => Promise<IpcInvokeResponse<'quick-note:open'>>
    readonly save: (
      input: QuickNoteSaveInput
    ) => Promise<IpcInvokeResponse<'quick-note:save'>>
    readonly respondToClose: (
      input: QuickNoteCloseResponseInput
    ) => Promise<IpcInvokeResponse<'quick-note:respond-to-close'>>
    readonly onCloseRequested: (
      listener: (request: QuickNoteCloseRequest) => void
    ) => Unsubscribe
  }
  readonly window: {
    readonly getState: () => Promise<IpcInvokeResponse<'window:get-state'>>
    readonly setAlwaysOnTop: (
      enabled: boolean
    ) => Promise<IpcInvokeResponse<'window:set-always-on-top'>>
  }
}
