import type { AssetReference, SaveImageAssetInput } from '../../shared/assets'
import type { AppResult } from '../../shared/result'

interface AssetStorage {
  readonly saveImage: (input: SaveImageAssetInput) => AssetReference
}

export interface AssetHandlers {
  readonly saveImage: (request: unknown) => AppResult<AssetReference>
}

const SAVE_IMAGE_FIELDS = ['fileName', 'mimeType', 'bytes']

function success<Value>(value: Value): AppResult<Value> {
  return {
    ok: true,
    value
  }
}

function failure(
  code: 'asset-save-failed' | 'validation-failed',
  message: string
): AppResult<never> {
  return {
    ok: false,
    error: {
      code,
      message
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSaveImageInput(request: unknown): AppResult<SaveImageAssetInput> {
  if (
    !isRecord(request) ||
    !Object.keys(request).every((key) => SAVE_IMAGE_FIELDS.includes(key)) ||
    typeof request.fileName !== 'string' ||
    request.fileName.trim().length === 0 ||
    typeof request.mimeType !== 'string' ||
    request.mimeType.trim().length === 0 ||
    !(request.bytes instanceof Uint8Array)
  ) {
    return failure('validation-failed', 'A valid image payload is required.')
  }

  return success({
    fileName: request.fileName,
    mimeType: request.mimeType,
    bytes: request.bytes
  })
}

export function createAssetHandlers(storage: AssetStorage): AssetHandlers {
  return {
    saveImage: (request) => {
      const input = parseSaveImageInput(request)

      if (!input.ok) {
        return input
      }

      try {
        return success(storage.saveImage(input.value))
      } catch {
        return failure(
          'asset-save-failed',
          'Unable to save this image. Use a PNG, JPEG, GIF, or WebP image up to 20 MiB.'
        )
      }
    }
  }
}
