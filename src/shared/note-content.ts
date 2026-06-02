export const DEFAULT_NOTE_TITLE = 'Untitled note'
export const NOTE_PREVIEW_MAX_LENGTH = 160

const NOTE_TITLE_MAX_LENGTH = 80

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^```.*$/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[(?: |x|X)\]\s*/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1')
}

export function createNotePreviewText(contentMarkdown: string): string {
  return truncateText(
    collapseWhitespace(stripMarkdown(contentMarkdown)),
    NOTE_PREVIEW_MAX_LENGTH
  )
}

export function deriveNoteTitle(contentMarkdown: string): string {
  const firstReadableLine = contentMarkdown
    .split(/\r?\n/)
    .map((line) => collapseWhitespace(stripMarkdown(line)))
    .find(Boolean)

  return firstReadableLine
    ? truncateText(firstReadableLine, NOTE_TITLE_MAX_LENGTH)
    : DEFAULT_NOTE_TITLE
}
