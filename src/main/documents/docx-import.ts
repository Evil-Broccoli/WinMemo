import mammothPackage from 'mammoth'
import type { AssetReference, SaveImageAssetInput } from '../../shared/assets'

export interface DocxAssetStorage {
  readonly saveImage: (input: SaveImageAssetInput) => AssetReference
}

export type DocxMarkdownImporter = (
  filePath: string,
  fileName: string
) => Promise<string>

interface MammothImage {
  readonly contentType: string
  readonly readAsBuffer: () => Promise<Buffer>
}

interface MammothImageAttributes {
  readonly src: string
}

interface MammothImageConverter {
  readonly __mammothBrand: 'ImageConverter'
}

interface MammothResult {
  readonly value: string
}

interface MammothOptions {
  readonly convertImage: MammothImageConverter
  readonly externalFileAccess: false
}

interface MammothModule {
  readonly convertToMarkdown: (
    input: { readonly path: string },
    options: MammothOptions
  ) => Promise<MammothResult>
  readonly images: {
    readonly imgElement: (
      convert: (image: MammothImage) => Promise<MammothImageAttributes>
    ) => MammothImageConverter
  }
}

const mammoth = mammothPackage as unknown as MammothModule

const DOCX_IMAGE_EXTENSIONS = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
} as const satisfies Record<string, string>

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, '\n').trim()
}

function getDocxStem(fileName: string): string {
  const stem = fileName.replace(/\.[^.]*$/, '').trim()

  return stem || 'document'
}

function getSupportedImageExtension(mimeType: string): string | undefined {
  return DOCX_IMAGE_EXTENSIONS[
    mimeType.trim().toLowerCase() as keyof typeof DOCX_IMAGE_EXTENSIONS
  ]
}

function createImageConverter(
  fileName: string,
  assetStorage: DocxAssetStorage | undefined
): MammothImageConverter {
  let imageIndex = 0
  const docxStem = getDocxStem(fileName)

  return mammoth.images.imgElement(async (image) => {
    if (!assetStorage) {
      throw new Error(
        'DOCX image skipped because asset storage is unavailable.'
      )
    }

    const mimeType = image.contentType.trim().toLowerCase()
    const extension = getSupportedImageExtension(mimeType)

    if (!extension) {
      throw new Error(`Unsupported DOCX image type: ${image.contentType}`)
    }

    imageIndex += 1

    const asset = assetStorage.saveImage({
      bytes: await image.readAsBuffer(),
      fileName: `${docxStem}-image-${imageIndex}.${extension}`,
      mimeType
    })

    return {
      src: asset.markdownUrl
    }
  })
}

export function createDocxMarkdownImporter(
  assetStorage?: DocxAssetStorage
): DocxMarkdownImporter {
  return async (filePath, fileName) => {
    const result = await mammoth.convertToMarkdown(
      {
        path: filePath
      },
      {
        convertImage: createImageConverter(fileName, assetStorage),
        externalFileAccess: false
      }
    )

    return normalizeMarkdown(result.value)
  }
}
