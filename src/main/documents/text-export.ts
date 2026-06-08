import { writeFile } from 'node:fs/promises'
import type { ExportFormat, ExportNoteResult } from '../../shared/documents'
import type { Note } from '../../shared/notes'

export interface ExportNoteFileInput {
  readonly note: Note
  readonly filePath: string
  readonly format: ExportFormat
}

const FENCED_CODE_MARKER_PATTERN = /^\s{0,3}(?:`{3,}|~{3,}).*$/gmu
const REFERENCE_DEFINITION_PATTERN = /^\s{0,3}\[[^\]]+\]:\s+\S+.*$/gmu
const THEMATIC_BREAK_PATTERN = /^\s{0,3}(?:[-*_]\s*){3,}$/gmu
const TABLE_SEPARATOR_ROW_PATTERN =
  /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u
const ESCAPED_MARKDOWN_PLACEHOLDER = '\uE000'

function protectEscapedMarkdown(line: string): {
  readonly line: string
  readonly escapedCharacters: readonly string[]
} {
  const escapedCharacters: string[] = []

  return {
    line: line.replace(/\\([\\`*_[\]{}()#+\-.!>])/gu, (_, character) => {
      escapedCharacters.push(String(character))

      return `${ESCAPED_MARKDOWN_PLACEHOLDER}${escapedCharacters.length - 1}${ESCAPED_MARKDOWN_PLACEHOLDER}`
    }),
    escapedCharacters
  }
}

function restoreEscapedMarkdown(
  line: string,
  escapedCharacters: readonly string[]
): string {
  return line.replace(
    /\uE000(\d+)\uE000/gu,
    (_, index) => escapedCharacters[Number(index)] ?? ''
  )
}

function normalizeTableRow(line: string): string {
  const trimmedLine = line.trim()

  if (!trimmedLine.includes('|')) {
    return line
  }

  return trimmedLine
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => cell.trim())
    .join('\t')
}

function stripInlineMarkdown(line: string): string {
  const protectedMarkdown = protectEscapedMarkdown(line)
  const strippedLine = protectedMarkdown.line
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/!\[([^\]]*)\]\[[^\]]*\]/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/gu, '$1')
    .replace(/<((?:https?|mailto):[^>\s]+)>/gu, '$1')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/~~([^~]+)~~/gu, '$1')
    .replace(/(\*\*|__)([^*\n_]+)\1/gu, '$2')
    .replace(/(^|[^\w])_([^_\n]+)_([^\w]|$)/gu, '$1$2$3')
    .replace(/(^|[^\w])\*([^*\n]+)\*([^\w]|$)/gu, '$1$2$3')
    .replace(/<[^>\n]+>/gu, '')

  return restoreEscapedMarkdown(
    strippedLine,
    protectedMarkdown.escapedCharacters
  )
}

function stripBlockMarkdown(line: string): string {
  return line
    .replace(/^\s{0,3}#{1,6}\s*/u, '')
    .replace(/\s+#{1,6}\s*$/u, '')
    .replace(/^\s{0,3}(?:>\s*)+/u, '')
    .replace(/^\s{0,3}(?:[-+*]|\d+[.)])\s+/u, '')
    .replace(/^\s*\[(?: |x|X)\]\s+/u, '')
}

export function markdownToPlainText(contentMarkdown: string): string {
  const blockStrippedContent = contentMarkdown
    .replace(/\r\n?/gu, '\n')
    .replace(/^\uFEFF/u, '')
    .replace(FENCED_CODE_MARKER_PATTERN, '')
    .replace(REFERENCE_DEFINITION_PATTERN, '')
    .replace(THEMATIC_BREAK_PATTERN, '')

  return blockStrippedContent
    .split('\n')
    .flatMap((line) => {
      const blockStrippedLine = stripBlockMarkdown(line)

      if (TABLE_SEPARATOR_ROW_PATTERN.test(blockStrippedLine)) {
        return []
      }

      return [normalizeTableRow(stripInlineMarkdown(blockStrippedLine))]
    })
    .join('\n')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

export async function exportTextNoteFile({
  note,
  filePath,
  format
}: ExportNoteFileInput): Promise<ExportNoteResult> {
  if (format === 'docx') {
    throw new Error('DOCX export is handled by the DOCX writer.')
  }

  await writeFile(
    filePath,
    format === 'txt'
      ? markdownToPlainText(note.contentMarkdown)
      : note.contentMarkdown,
    'utf8'
  )

  return {
    status: 'exported',
    filePath,
    format
  }
}
