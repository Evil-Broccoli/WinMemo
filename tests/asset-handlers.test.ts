import assert from 'node:assert/strict'
import test from 'node:test'
import { createAssetHandlers } from '../src/main/assets/asset-handlers'
import type { SaveImageAssetInput } from '../src/shared/assets'

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
])

test('passes validated image payloads to asset storage', () => {
  let savedInput: SaveImageAssetInput | undefined
  const handlers = createAssetHandlers({
    saveImage: (input) => {
      savedInput = input

      return {
        id: 'asset-id',
        fileName: 'capture.png',
        mimeType: 'image/png',
        markdownUrl: 'windows-memo-asset://local/asset-id.png'
      }
    }
  })
  const result = handlers.saveImage({
    fileName: 'capture.png',
    mimeType: 'image/png',
    bytes: PNG_BYTES
  })

  assert.equal(result.ok, true)
  assert.deepEqual(savedInput, {
    fileName: 'capture.png',
    mimeType: 'image/png',
    bytes: PNG_BYTES
  })
})

test('rejects malformed image payloads before calling storage', () => {
  let saveCount = 0
  const handlers = createAssetHandlers({
    saveImage: () => {
      saveCount += 1
      throw new Error('Storage should not be called.')
    }
  })

  assert.deepEqual(
    handlers.saveImage({
      fileName: 'capture.png',
      mimeType: 'image/png',
      bytes: PNG_BYTES,
      externalPath: 'C:\\private\\capture.png'
    }),
    {
      ok: false,
      error: {
        code: 'validation-failed',
        message: 'A valid image payload is required.'
      }
    }
  )
  assert.equal(saveCount, 0)
})

test('returns a stable user-facing error when asset storage fails', () => {
  const handlers = createAssetHandlers({
    saveImage: () => {
      throw new Error('C:\\private\\assets is not writable.')
    }
  })

  assert.deepEqual(
    handlers.saveImage({
      fileName: 'capture.png',
      mimeType: 'image/png',
      bytes: PNG_BYTES
    }),
    {
      ok: false,
      error: {
        code: 'asset-save-failed',
        message:
          'Unable to save this image. Use a PNG, JPEG, GIF, or WebP image up to 20 MiB.'
      }
    }
  )
})
