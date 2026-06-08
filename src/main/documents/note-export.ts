import type { ExportNoteResult } from '../../shared/documents'
import type { DocxAssetResolver } from './docx-export'
import { exportDocxNote } from './docx-export'
import type { ExportNoteFileInput } from './text-export'
import { exportTextNoteFile } from './text-export'

export function createExportNoteFile(
  assetResolver?: DocxAssetResolver
): (input: ExportNoteFileInput) => Promise<ExportNoteResult> {
  return (input) => {
    if (input.format === 'docx') {
      return exportDocxNote({
        note: input.note,
        filePath: input.filePath,
        assetResolver
      })
    }

    return exportTextNoteFile(input)
  }
}
