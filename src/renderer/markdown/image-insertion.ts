import type { AssetReference } from '@shared/assets'
import type { DesktopBridge } from '@shared/ipc'

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp'
])

interface MarkdownInsertion {
  readonly contentMarkdown: string
  readonly cursorPosition: number
}

type SaveImage = DesktopBridge['assets']['saveImage']

function isSupportedImageFile(file: Pick<File, 'type'>): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())
}

function getBlockLeadingSpacing(textBefore: string): string {
  if (!textBefore || textBefore.endsWith('\n\n')) {
    return ''
  }

  return textBefore.endsWith('\n') ? '\n' : '\n\n'
}

function getBlockTrailingSpacing(textAfter: string): string {
  if (textAfter.startsWith('\n\n')) {
    return ''
  }

  return textAfter.startsWith('\n') ? '\n' : '\n\n'
}

function createImageMarkdown(reference: AssetReference): string {
  const altText = reference.fileName.replace(/([\\[\]])/g, '\\$1')

  return `![${altText}](${reference.markdownUrl})`
}

export function hasFilePayload(dataTransfer: DataTransfer): boolean {
  return (
    dataTransfer.files.length > 0 ||
    Array.from(dataTransfer.items).some((item) => item.kind === 'file')
  )
}

export function hasSupportedImagePayload(dataTransfer: DataTransfer): boolean {
  return (
    Array.from(dataTransfer.files).some(isSupportedImageFile) ||
    Array.from(dataTransfer.items).some(
      (item) => item.kind === 'file' && isSupportedImageFile(item)
    )
  )
}

export function getSupportedImageFiles(dataTransfer: DataTransfer): File[] {
  const itemFiles = Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
  const files =
    itemFiles.length > 0 ? itemFiles : Array.from(dataTransfer.files)

  return files.filter(isSupportedImageFile)
}

export function insertImageReferences(
  contentMarkdown: string,
  references: readonly AssetReference[],
  selectionStart: number,
  selectionEnd: number
): MarkdownInsertion {
  const safeSelectionStart = Math.max(
    0,
    Math.min(selectionStart, contentMarkdown.length)
  )
  const safeSelectionEnd = Math.max(
    safeSelectionStart,
    Math.min(selectionEnd, contentMarkdown.length)
  )
  const textBefore = contentMarkdown.slice(0, safeSelectionStart)
  const textAfter = contentMarkdown.slice(safeSelectionEnd)

  if (references.length === 0) {
    return {
      contentMarkdown,
      cursorPosition: safeSelectionStart
    }
  }

  const leadingSpacing = getBlockLeadingSpacing(textBefore)
  const trailingSpacing = getBlockTrailingSpacing(textAfter)
  const imageMarkdown = references.map(createImageMarkdown).join('\n\n')
  const insertedMarkdown = `${leadingSpacing}${imageMarkdown}${trailingSpacing}`

  return {
    contentMarkdown: `${textBefore}${insertedMarkdown}${textAfter}`,
    cursorPosition: textBefore.length + insertedMarkdown.length
  }
}

export async function saveImageFiles(
  files: readonly File[],
  saveImage: SaveImage
): Promise<readonly AssetReference[]> {
  return Promise.all(
    files.map(async (file) => {
      const result = await saveImage({
        fileName: file.name || 'pasted-image',
        mimeType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer())
      })

      if (!result.ok) {
        throw new Error(result.error.message)
      }

      return result.value
    })
  )
}
