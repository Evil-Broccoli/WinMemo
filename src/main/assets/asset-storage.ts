import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { AssetReference, SaveImageAssetInput } from '../../shared/assets'

export const ASSET_DIRECTORY_NAME = 'assets'
export const ASSET_MARKDOWN_URL_BASE = 'windows-memo-asset://local/'
export const MAX_IMAGE_ASSET_BYTES = 20 * 1024 * 1024

interface ImageAssetFormat {
  readonly extension: string
  readonly matchesSignature: (bytes: Uint8Array) => boolean
}

const IMAGE_ASSET_FORMATS = {
  'image/gif': {
    extension: 'gif',
    matchesSignature: (bytes) =>
      startsWithAscii(bytes, 'GIF87a') || startsWithAscii(bytes, 'GIF89a')
  },
  'image/jpeg': {
    extension: 'jpg',
    matchesSignature: (bytes) =>
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  },
  'image/png': {
    extension: 'png',
    matchesSignature: (bytes) =>
      startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  },
  'image/webp': {
    extension: 'webp',
    matchesSignature: (bytes) =>
      startsWithAscii(bytes, 'RIFF') &&
      startsWithAscii(bytes.subarray(8), 'WEBP')
  }
} as const satisfies Record<string, ImageAssetFormat>

const STORED_ASSET_FILE_NAME_PATTERN = /^[a-f0-9]{64}\.(?:gif|jpg|png|webp)$/

let assetStorage: AssetStorageService | undefined

function startsWithAscii(bytes: Uint8Array, expected: string): boolean {
  return startsWithBytes(
    bytes,
    [...expected].map((character) => character.charCodeAt(0))
  )
}

function startsWithBytes(
  bytes: Uint8Array,
  expected: readonly number[]
): boolean {
  return expected.every((byte, index) => bytes[index] === byte)
}

function createAssetId(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function normalizeDisplayFileName(fileName: string, extension: string): string {
  const lastPathSegment = fileName.trim().split(/[\\/]/).at(-1) ?? ''
  const withoutExtension = lastPathSegment.replace(/\.[^.]*$/, '')
  const safeStem = [...withoutExtension]
    .filter(
      (character) =>
        character.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(character)
    )
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 100)

  return `${safeStem || 'image'}.${extension}`
}

function getImageAssetFormat(mimeType: string): ImageAssetFormat {
  const normalizedMimeType = mimeType.trim().toLowerCase()
  const format =
    IMAGE_ASSET_FORMATS[normalizedMimeType as keyof typeof IMAGE_ASSET_FORMATS]

  if (!format) {
    throw new Error(`Unsupported image MIME type: ${mimeType}`)
  }

  return format
}

function isFileExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EEXIST'
  )
}

export function getAssetDirectoryPath(userDataPath: string): string {
  return join(userDataPath, ASSET_DIRECTORY_NAME)
}

export function initializeAssetStorage(
  userDataPath: string
): AssetStorageService {
  if (!assetStorage) {
    assetStorage = new AssetStorageService(getAssetDirectoryPath(userDataPath))
  }

  return assetStorage
}

export function getAssetStorage(): AssetStorageService {
  if (!assetStorage) {
    throw new Error('Asset storage has not been initialized.')
  }

  return assetStorage
}

export class AssetStorageService {
  public readonly directoryPath: string

  public constructor(directoryPath: string) {
    this.directoryPath = resolve(directoryPath)
    mkdirSync(this.directoryPath, { recursive: true })
  }

  public saveImage(input: SaveImageAssetInput): AssetReference {
    if (typeof input.fileName !== 'string') {
      throw new Error('Image file name must be text.')
    }

    if (typeof input.mimeType !== 'string') {
      throw new Error('Image MIME type must be text.')
    }

    if (!(input.bytes instanceof Uint8Array)) {
      throw new Error('Image bytes must be a Uint8Array.')
    }

    if (input.bytes.byteLength === 0) {
      throw new Error('Image bytes cannot be empty.')
    }

    if (input.bytes.byteLength > MAX_IMAGE_ASSET_BYTES) {
      throw new Error(
        `Image asset exceeds the ${MAX_IMAGE_ASSET_BYTES} byte size limit.`
      )
    }

    const format = getImageAssetFormat(input.mimeType)

    if (!format.matchesSignature(input.bytes)) {
      throw new Error('Image bytes do not match the declared MIME type.')
    }

    const id = createAssetId(input.bytes)
    const storedFileName = `${id}.${format.extension}`
    const storedFilePath = this.getStoredFilePath(storedFileName)

    this.writeAssetFile(storedFilePath, id, input.bytes)

    return {
      id,
      fileName: normalizeDisplayFileName(input.fileName, format.extension),
      mimeType: input.mimeType.trim().toLowerCase(),
      markdownUrl: `${ASSET_MARKDOWN_URL_BASE}${storedFileName}`
    }
  }

  public resolveMarkdownUrl(markdownUrl: string): string | undefined {
    let parsedUrl: URL

    try {
      parsedUrl = new URL(markdownUrl)
    } catch {
      return undefined
    }

    if (
      parsedUrl.protocol !== 'windows-memo-asset:' ||
      parsedUrl.hostname !== 'local' ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.port ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      return undefined
    }

    let storedFileName: string

    try {
      storedFileName = decodeURIComponent(parsedUrl.pathname.slice(1))
    } catch {
      return undefined
    }

    if (!STORED_ASSET_FILE_NAME_PATTERN.test(storedFileName)) {
      return undefined
    }

    const storedFilePath = this.getStoredFilePath(storedFileName)

    if (!existsSync(storedFilePath) || !lstatSync(storedFilePath).isFile()) {
      return undefined
    }

    return storedFilePath
  }

  private getStoredFilePath(storedFileName: string): string {
    const storedFilePath = resolve(this.directoryPath, storedFileName)

    if (dirname(storedFilePath) !== this.directoryPath) {
      throw new Error('Asset storage path escaped the managed directory.')
    }

    return storedFilePath
  }

  private writeAssetFile(
    storedFilePath: string,
    expectedId: string,
    bytes: Uint8Array
  ): void {
    try {
      writeFileSync(storedFilePath, bytes, { flag: 'wx' })
    } catch (error) {
      if (!isFileExistsError(error)) {
        throw error
      }

      if (!lstatSync(storedFilePath).isFile()) {
        throw new Error('Existing asset path is not a regular file.')
      }

      const storedBytes = readFileSync(storedFilePath)

      if (createAssetId(storedBytes) !== expectedId) {
        writeFileSync(storedFilePath, bytes)
      }
    }
  }
}
