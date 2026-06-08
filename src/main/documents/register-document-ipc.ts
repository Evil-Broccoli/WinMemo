import { BrowserWindow, dialog, ipcMain } from 'electron'
import type {
  IpcMainInvokeEvent,
  OpenDialogOptions,
  SaveDialogOptions
} from 'electron'
import { IPC_INVOKE_CHANNELS } from '../../shared/ipc'
import type { ExportFormat } from '../../shared/documents'
import type { Note } from '../../shared/notes'
import type { AssetStorageService } from '../assets/asset-storage'
import type { NoteRepository } from '../persistence/note-repository'
import { createDocxMarkdownImporter } from './docx-import'
import { createDocumentHandlers } from './document-handlers'
import { createExportNoteFile } from './note-export'

const IMPORT_DIALOG_OPTIONS: OpenDialogOptions = {
  title: 'Import notes',
  buttonLabel: 'Import',
  properties: ['openFile', 'multiSelections'],
  filters: [
    {
      name: 'Supported documents',
      extensions: ['txt', 'md', 'docx']
    },
    {
      name: 'Text files',
      extensions: ['txt']
    },
    {
      name: 'Markdown files',
      extensions: ['md']
    },
    {
      name: 'Word documents',
      extensions: ['docx']
    },
    {
      name: 'Legacy Word documents (convert to DOCX)',
      extensions: ['doc']
    }
  ]
}

const EXPORT_DIALOG_FILTERS: Record<
  ExportFormat,
  NonNullable<SaveDialogOptions['filters']>[number]
> = {
  txt: {
    name: 'Text file',
    extensions: ['txt']
  },
  md: {
    name: 'Markdown file',
    extensions: ['md']
  },
  docx: {
    name: 'Word document',
    extensions: ['docx']
  }
}

async function showImportFilePicker(
  parentWindow: BrowserWindow | undefined
): Promise<readonly string[] | undefined> {
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, IMPORT_DIALOG_OPTIONS)
    : await dialog.showOpenDialog(IMPORT_DIALOG_OPTIONS)

  return result.canceled ? undefined : result.filePaths
}

function getExportFilters(
  preferredFormat: ExportFormat
): SaveDialogOptions['filters'] {
  const preferredFilter = EXPORT_DIALOG_FILTERS[preferredFormat]

  return [
    preferredFilter,
    ...Object.entries(EXPORT_DIALOG_FILTERS)
      .filter(([format]) => format !== preferredFormat)
      .map(([, filter]) => filter)
  ]
}

function getSafeExportFileStem(title: string): string {
  const stem = Array.from(title)
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0

      return codePoint < 32 || '<>:"/\\|?*'.includes(character)
        ? ' '
        : character
    })
    .join('')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[. ]+$/u, '')

  return stem || 'Untitled note'
}

function getExportDialogOptions(
  note: Note,
  format: ExportFormat
): SaveDialogOptions {
  return {
    title: 'Export note',
    buttonLabel: 'Export',
    defaultPath: `${getSafeExportFileStem(note.title)}.${format}`,
    filters: getExportFilters(format)
  }
}

async function showExportFilePicker(
  parentWindow: BrowserWindow | undefined,
  note: Note,
  format: ExportFormat
): Promise<string | undefined> {
  const options = getExportDialogOptions(note, format)
  const result = parentWindow
    ? await dialog.showSaveDialog(parentWindow, options)
    : await dialog.showSaveDialog(options)

  return result.canceled ? undefined : result.filePath
}

function getParentWindow(event: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined
}

export function registerDocumentIpcHandlers(
  repository: NoteRepository,
  assetStorage: AssetStorageService
): () => void {
  const channels = IPC_INVOKE_CHANNELS.documents
  const importDocxFile = createDocxMarkdownImporter(assetStorage)
  const exportNoteFile = createExportNoteFile(assetStorage)

  ipcMain.handle(channels.importNotes, (event) => {
    const parentWindow = getParentWindow(event)
    const handlers = createDocumentHandlers({
      dialog: {
        showImportFilePicker: () => showImportFilePicker(parentWindow)
      },
      repository,
      importDocxFile,
      exportNoteFile
    })

    return handlers.importNotes()
  })

  ipcMain.handle(channels.exportNote, (event, request: unknown) => {
    const parentWindow = getParentWindow(event)
    const handlers = createDocumentHandlers({
      dialog: {
        showExportFilePicker: ({ note, format }) =>
          showExportFilePicker(parentWindow, note, format)
      },
      repository,
      importDocxFile
    })

    return handlers.exportNote(request)
  })

  return () => {
    ipcMain.removeHandler(channels.importNotes)
    ipcMain.removeHandler(channels.exportNote)
  }
}
