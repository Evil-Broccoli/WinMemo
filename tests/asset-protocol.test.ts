import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createAssetProtocolResponse } from '../src/main/assets/asset-protocol'
import { AssetStorageService } from '../src/main/assets/asset-storage'

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d
])

test('serves stored image bytes through the managed asset protocol', async () => {
  const directoryPath = mkdtempSync(join(tmpdir(), 'windows-memo-protocol-'))

  try {
    const storage = new AssetStorageService(directoryPath)
    const reference = storage.saveImage({
      fileName: 'capture.png',
      mimeType: 'image/png',
      bytes: PNG_BYTES
    })
    const response = createAssetProtocolResponse(storage, reference.markdownUrl)

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'image/png')
    assert.equal(
      response.headers.get('Cache-Control'),
      'public, max-age=31536000, immutable'
    )
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), PNG_BYTES)
  } finally {
    rmSync(directoryPath, { recursive: true, force: true })
  }
})

test('returns not found for invalid managed asset URLs', () => {
  const response = createAssetProtocolResponse(
    {
      resolveMarkdownUrl: () => undefined
    },
    'windows-memo-asset://local/missing.png'
  )

  assert.equal(response.status, 404)
})
