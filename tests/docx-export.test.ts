import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { exportDocxNote } from '../src/main/documents/docx-export'
import { createDocxMarkdownImporter } from '../src/main/documents/docx-import'
import type { Note } from '../src/shared/notes'

const STATIC_TIMESTAMP = '2026-06-08T02:00:00.000Z'

function createTempDirectory(): string {
  return mkdtempSync(join(tmpdir(), 'windows-memo-docx-export-'))
}

function removeTempDirectory(directoryPath: string): void {
  const resolvedTempDirectory = resolve(tmpdir())
  const resolvedDirectoryPath = resolve(directoryPath)

  if (
    !resolvedDirectoryPath.startsWith(
      join(resolvedTempDirectory, 'windows-memo-docx-export-')
    )
  ) {
    throw new Error(`Refusing to remove unexpected path: ${directoryPath}`)
  }

  rmSync(resolvedDirectoryPath, { recursive: true, force: true })
}

function createTestNote(overrides?: Partial<Note>): Note {
  return {
    id: 'note-1',
    title: 'Meeting notes',
    contentMarkdown: '# Meeting notes\n\nFollow up.',
    previewText: 'Meeting notes Follow up.',
    createdAt: STATIC_TIMESTAMP,
    updatedAt: STATIC_TIMESTAMP,
    pinned: false,
    sourceType: 'note',
    ...overrides
  }
}

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

test('exports Markdown note content as a readable docx file', async () => {
  const tempDirectory = createTempDirectory()

  try {
    const filePath = join(tempDirectory, 'meeting.docx')
    const note = createTestNote({
      title: 'Planning memo',
      contentMarkdown: [
        '# Planning memo',
        '',
        'Review [brief](https://example.com/brief) and **confirm** scope.',
        '',
        '- [x] Capture requirements',
        '- Draft export notes',
        '',
        '| Item | Status |',
        '| --- | --- |',
        '| TXT | Done |',
        '| DOCX | Ready |',
        '',
        '```ts',
        'const ready = true',
        '```'
      ].join('\n')
    })

    assert.deepEqual(await exportDocxNote({ note, filePath }), {
      status: 'exported',
      filePath,
      format: 'docx'
    })
    assert.equal(existsSync(filePath), true)
    assert.ok(statSync(filePath).size > 0)

    const importedMarkdown = await createDocxMarkdownImporter()(
      filePath,
      'meeting.docx'
    )

    assert.match(importedMarkdown, /Planning memo/)
    assert.match(
      importedMarkdown,
      /Review \[brief\]\(https:\/\/example.com\/brief\)/
    )
    assert.match(importedMarkdown, /Capture requirements/)
    assert.match(importedMarkdown, /TXT/)
    assert.match(importedMarkdown, /DOCX/)
    assert.match(importedMarkdown, /const ready = true/)
  } finally {
    removeTempDirectory(tempDirectory)
  }
})

test('embeds resolvable managed images during docx export', async () => {
  const tempDirectory = createTempDirectory()

  try {
    const filePath = join(tempDirectory, 'image-note.docx')
    const imageUrl = 'windows-memo-asset://local/image.png'
    const resolvedUrls: string[] = []
    const note = createTestNote({
      contentMarkdown: [
        '# Image note',
        '',
        `![Tiny picture](${imageUrl})`,
        '',
        'Image caption.'
      ].join('\n')
    })

    await exportDocxNote({
      note,
      filePath,
      assetResolver: {
        resolveMarkdownUrl: (markdownUrl) => {
          resolvedUrls.push(markdownUrl)

          return getFixturePath('tiny-picture.png')
        }
      }
    })

    assert.deepEqual(resolvedUrls, [imageUrl])
    assert.equal(existsSync(filePath), true)
    assert.ok(statSync(filePath).size > 0)
  } finally {
    removeTempDirectory(tempDirectory)
  }
})
