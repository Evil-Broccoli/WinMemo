import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { createDocxMarkdownImporter } from '../src/main/documents/docx-import'
import type { SaveImageAssetInput } from '../src/shared/assets'

function getFixturePath(fileName: string): string {
  return join(
    process.cwd(),
    'node_modules',
    'mammoth',
    'test',
    'test-data',
    fileName
  )
}

test('converts normal docx content into Markdown', async () => {
  const importer = createDocxMarkdownImporter()

  assert.equal(
    await importer(getFixturePath('single-paragraph.docx'), 'memo.docx'),
    'Walking on imported air'
  )
  assert.equal(
    await importer(getFixturePath('simple-list.docx'), 'memo.docx'),
    '- Apple\n- Banana'
  )
})

test('stores supported docx images as managed Markdown references', async () => {
  const savedImages: SaveImageAssetInput[] = []
  const importer = createDocxMarkdownImporter({
    saveImage: (input) => {
      savedImages.push(input)

      return {
        id: 'asset-id',
        fileName: input.fileName,
        mimeType: input.mimeType,
        markdownUrl: 'windows-memo-asset://local/asset-id.png'
      }
    }
  })

  assert.equal(
    await importer(getFixturePath('tiny-picture.docx'), 'picture memo.docx'),
    '![](windows-memo-asset://local/asset-id.png)'
  )
  assert.deepEqual(
    savedImages.map((image) => ({
      byteLength: image.bytes.byteLength,
      fileName: image.fileName,
      mimeType: image.mimeType
    })),
    [
      {
        byteLength: 110,
        fileName: 'picture memo-image-1.png',
        mimeType: 'image/png'
      }
    ]
  )
})

test('skips docx images when asset storage is unavailable', async () => {
  const importer = createDocxMarkdownImporter()

  assert.equal(
    await importer(getFixturePath('tiny-picture.docx'), 'picture memo.docx'),
    ''
  )
})
