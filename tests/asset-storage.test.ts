import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import {
  ASSET_MARKDOWN_URL_BASE,
  AssetStorageService,
  getAssetDirectoryPath
} from '../src/main/assets/asset-storage'

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d
])

function createTempDirectory(): string {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return resolve(tmpdir(), `windows-memo-assets-test-${suffix}`)
}

function removeTempDirectory(directoryPath: string): void {
  const resolvedTempDirectory = resolve(tmpdir())
  const resolvedDirectoryPath = resolve(directoryPath)

  if (
    !resolvedDirectoryPath.startsWith(
      join(resolvedTempDirectory, 'windows-memo-assets-test-')
    )
  ) {
    throw new Error(`Refusing to remove unexpected path: ${directoryPath}`)
  }

  rmSync(resolvedDirectoryPath, { recursive: true, force: true })
}

function withAssetStorage(
  run: (service: AssetStorageService, userDataPath: string) => void
): void {
  const userDataPath = createTempDirectory()
  const service = new AssetStorageService(getAssetDirectoryPath(userDataPath))

  try {
    run(service, userDataPath)
  } finally {
    removeTempDirectory(userDataPath)
  }
}

test('saves images into the managed asset directory with a stable Markdown URL', () => {
  withAssetStorage((service, userDataPath) => {
    const expectedId = createHash('sha256').update(PNG_BYTES).digest('hex')
    const expectedPath = join(
      getAssetDirectoryPath(userDataPath),
      `${expectedId}.png`
    )
    const reference = service.saveImage({
      fileName: '..\\captures\\Daily capture.PNG',
      mimeType: 'IMAGE/PNG',
      bytes: PNG_BYTES
    })

    assert.deepEqual(reference, {
      id: expectedId,
      fileName: 'Daily capture.png',
      mimeType: 'image/png',
      markdownUrl: `${ASSET_MARKDOWN_URL_BASE}${expectedId}.png`
    })
    assert.equal(
      service.resolveMarkdownUrl(reference.markdownUrl),
      expectedPath
    )
    assert.deepEqual(readFileSync(expectedPath), Buffer.from(PNG_BYTES))
  })
})

test('deduplicates identical image bytes without losing display metadata', () => {
  withAssetStorage((service) => {
    const firstReference = service.saveImage({
      fileName: 'first.png',
      mimeType: 'image/png',
      bytes: PNG_BYTES
    })
    const secondReference = service.saveImage({
      fileName: 'second.png',
      mimeType: 'image/png',
      bytes: PNG_BYTES
    })

    assert.equal(firstReference.id, secondReference.id)
    assert.equal(firstReference.markdownUrl, secondReference.markdownUrl)
    assert.equal(firstReference.fileName, 'first.png')
    assert.equal(secondReference.fileName, 'second.png')
    assert.deepEqual(readdirSync(service.directoryPath), [
      `${firstReference.id}.png`
    ])
  })
})

test('rejects unsupported, mismatched, empty, and oversized image payloads', () => {
  withAssetStorage((service) => {
    assert.throws(
      () =>
        service.saveImage({
          fileName: 'vector.svg',
          mimeType: 'image/svg+xml',
          bytes: PNG_BYTES
        }),
      /Unsupported image MIME type/
    )
    assert.throws(
      () =>
        service.saveImage({
          fileName: 'mismatch.jpg',
          mimeType: 'image/jpeg',
          bytes: PNG_BYTES
        }),
      /do not match/
    )
    assert.throws(
      () =>
        service.saveImage({
          fileName: 'empty.png',
          mimeType: 'image/png',
          bytes: new Uint8Array()
        }),
      /cannot be empty/
    )
    assert.throws(
      () =>
        service.saveImage({
          fileName: 'large.png',
          mimeType: 'image/png',
          bytes: new Uint8Array(20 * 1024 * 1024 + 1)
        }),
      /exceeds/
    )
  })
})

test('returns undefined for missing files and unsafe Markdown URLs', () => {
  withAssetStorage((service) => {
    const reference = service.saveImage({
      fileName: 'temporary.png',
      mimeType: 'image/png',
      bytes: PNG_BYTES
    })
    const storedFilePath = service.resolveMarkdownUrl(reference.markdownUrl)

    assert.ok(storedFilePath)
    unlinkSync(storedFilePath)
    assert.equal(existsSync(storedFilePath), false)
    assert.equal(service.resolveMarkdownUrl(reference.markdownUrl), undefined)
    assert.equal(
      service.resolveMarkdownUrl('file:///C:/Users/example/private.png'),
      undefined
    )
    assert.equal(
      service.resolveMarkdownUrl('windows-memo-asset://local/../private.png'),
      undefined
    )
    assert.equal(
      service.resolveMarkdownUrl(
        `windows-memo-asset://remote/${reference.id}.png`
      ),
      undefined
    )
  })
})
