import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSupportedImageFiles,
  hasFilePayload,
  hasSupportedImagePayload,
  insertImageReferences,
  saveImageFiles
} from '../src/renderer/markdown/image-insertion'
import type { AssetReference, SaveImageAssetInput } from '../src/shared/assets'
import type { AppResult } from '../src/shared/result'

const reference: AssetReference = {
  id: '0123456789abcdef',
  fileName: 'capture [one].png',
  mimeType: 'image/png',
  markdownUrl:
    'windows-memo-asset://local/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png'
}

function createFile(
  name: string,
  type: string,
  bytes = new Uint8Array([1, 2, 3])
): File {
  return {
    name,
    type,
    arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer
  } as File
}

function createDataTransfer(files: readonly File[]): DataTransfer {
  return {
    files,
    items: files.map((file) => ({
      kind: 'file',
      type: file.type,
      getAsFile: () => file
    }))
  } as unknown as DataTransfer
}

test('inserts escaped managed image Markdown as its own block', () => {
  const insertion = insertImageReferences('BeforeAfter', [reference], 6, 6)

  assert.equal(
    insertion.contentMarkdown,
    [
      'Before',
      '',
      '![capture \\[one\\].png](windows-memo-asset://local/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png)',
      '',
      'After'
    ].join('\n')
  )
  assert.equal(
    insertion.cursorPosition,
    insertion.contentMarkdown.indexOf('After')
  )
})

test('appends image Markdown and leaves a blank line for continued typing', () => {
  const insertion = insertImageReferences('', [reference], 0, 0)

  assert.equal(
    insertion.contentMarkdown,
    '![capture \\[one\\].png](windows-memo-asset://local/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png)\n\n'
  )
  assert.equal(insertion.cursorPosition, insertion.contentMarkdown.length)
})

test('extracts supported image files without accepting unrelated files', () => {
  const pngFile = createFile('capture.png', 'image/png')
  const textFile = createFile('notes.txt', 'text/plain')
  const dataTransfer = createDataTransfer([pngFile, textFile])

  assert.equal(hasFilePayload(dataTransfer), true)
  assert.equal(hasSupportedImagePayload(dataTransfer), true)
  assert.deepEqual(getSupportedImageFiles(dataTransfer), [pngFile])
})

test('saves image files through the typed asset bridge in parallel order', async () => {
  const files = [
    createFile('first.png', 'image/png', new Uint8Array([1])),
    createFile('second.png', 'image/png', new Uint8Array([2]))
  ]
  const savedFileNames: string[] = []
  const saveImage = async ({
    fileName
  }: SaveImageAssetInput): Promise<AppResult<AssetReference>> => {
    savedFileNames.push(fileName)

    return {
      ok: true,
      value: {
        ...reference,
        fileName
      }
    }
  }
  const references = await saveImageFiles(files, saveImage)

  assert.deepEqual(savedFileNames, ['first.png', 'second.png'])
  assert.deepEqual(
    references.map((savedReference) => savedReference.fileName),
    ['first.png', 'second.png']
  )
})
