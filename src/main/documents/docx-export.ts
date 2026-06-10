import { readFile, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LevelSuffix,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType
} from 'docx'
import type { FileChild, ParagraphChild } from 'docx'
import type { ExportNoteResult } from '../../shared/documents'
import type { Note } from '../../shared/notes'
import { markdownToPlainText } from './text-export'

export interface DocxAssetResolver {
  readonly resolveMarkdownUrl: (markdownUrl: string) => string | undefined
}

export interface ExportDocxNoteInput {
  readonly note: Note
  readonly filePath: string
  readonly assetResolver?: DocxAssetResolver
}

type InlineToken =
  | {
      readonly kind: 'text'
      readonly text: string
      readonly bold?: boolean
      readonly italics?: boolean
      readonly strike?: boolean
      readonly code?: boolean
    }
  | {
      readonly kind: 'link'
      readonly text: string
      readonly href: string
    }
  | {
      readonly kind: 'image'
      readonly alt: string
      readonly src: string
    }

type MarkdownBlock =
  | {
      readonly kind: 'paragraph'
      readonly text: string
    }
  | {
      readonly kind: 'heading'
      readonly level: number
      readonly text: string
    }
  | {
      readonly kind: 'list-item'
      readonly ordered: boolean
      readonly checked?: boolean
      readonly text: string
    }
  | {
      readonly kind: 'quote'
      readonly text: string
    }
  | {
      readonly kind: 'code'
      readonly text: string
    }
  | {
      readonly kind: 'table'
      readonly rows: readonly (readonly string[])[]
    }

const DOCUMENT_MARGIN_TWIPS = 1440
const TABLE_WIDTH_TWIPS = 9360
const BULLET_NUMBERING_REFERENCE = 'windows-memo-bullet'
const ORDERED_NUMBERING_REFERENCE = 'windows-memo-ordered'
const IMAGE_MAX_WIDTH = 520
const IMAGE_MAX_HEIGHT = 320

const INLINE_TOKEN_PATTERN =
  /(!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<((?:https?|mailto):[^>\s]+)>|`([^`]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|(^|[^\w])\*([^*\n]+)\*([^\w]|$)|(^|[^\w])_([^_\n]+)_([^\w]|$))/gu

function normalizeMarkdown(contentMarkdown: string): string {
  return contentMarkdown.replace(/\r\n?/gu, '\n').replace(/^\uFEFF/u, '')
}

function trimHeadingMarker(text: string): string {
  return text.replace(/\s+#{1,6}\s*$/u, '').trim()
}

function isTableSeparatorLine(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u.test(line)
}

function parseTableCells(line: string): readonly string[] {
  return line
    .trim()
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => markdownToPlainText(cell.trim()))
}

function parseMarkdownBlocks(contentMarkdown: string): MarkdownBlock[] {
  const lines = normalizeMarkdown(contentMarkdown).split('\n')
  const blocks: MarkdownBlock[] = []
  let paragraphLines: string[] = []
  let codeLines: string[] | undefined
  let tableRows: string[][] = []

  function flushParagraph(): void {
    const text = paragraphLines.join('\n').trim()

    paragraphLines = []

    if (text.length > 0) {
      blocks.push({
        kind: 'paragraph',
        text
      })
    }
  }

  function flushTable(): void {
    if (tableRows.length > 0) {
      blocks.push({
        kind: 'table',
        rows: tableRows
      })
      tableRows = []
    }
  }

  for (const line of lines) {
    const codeFenceMatch = line.match(/^\s{0,3}(?:`{3,}|~{3,})/u)

    if (codeFenceMatch) {
      flushParagraph()
      flushTable()

      if (codeLines) {
        blocks.push({
          kind: 'code',
          text: codeLines.join('\n')
        })
        codeLines = undefined
      } else {
        codeLines = []
      }

      continue
    }

    if (codeLines) {
      codeLines.push(line)
      continue
    }

    if (line.trim().length === 0) {
      flushParagraph()
      flushTable()
      continue
    }

    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/u)

    if (headingMatch) {
      flushParagraph()
      flushTable()
      blocks.push({
        kind: 'heading',
        level: headingMatch[1]?.length ?? 1,
        text: trimHeadingMarker(headingMatch[2] ?? '')
      })
      continue
    }

    const listMatch = line.match(/^\s{0,3}((?:[-+*])|(?:\d+[.)]))\s+(.+)$/u)

    if (listMatch) {
      flushParagraph()
      flushTable()

      const marker = listMatch[1] ?? ''
      const rawText = listMatch[2] ?? ''
      const taskMatch = rawText.match(/^\[( |x|X)\]\s+(.+)$/u)

      blocks.push({
        kind: 'list-item',
        ordered: /\d/u.test(marker[0] ?? ''),
        checked: taskMatch ? taskMatch[1]?.toLowerCase() === 'x' : undefined,
        text: taskMatch ? (taskMatch[2] ?? '') : rawText
      })
      continue
    }

    if (/^\s{0,3}>/u.test(line)) {
      flushParagraph()
      flushTable()
      blocks.push({
        kind: 'quote',
        text: line.replace(/^\s{0,3}(?:>\s*)+/u, '')
      })
      continue
    }

    if (line.includes('|')) {
      if (isTableSeparatorLine(line)) {
        flushParagraph()
        continue
      }

      flushParagraph()
      tableRows.push([...parseTableCells(line)])
      continue
    }

    flushTable()
    paragraphLines.push(line)
  }

  flushParagraph()
  flushTable()

  if (codeLines) {
    blocks.push({
      kind: 'code',
      text: codeLines.join('\n')
    })
  }

  return blocks
}

function pushTextToken(
  tokens: InlineToken[],
  text: string,
  options?: Omit<Extract<InlineToken, { kind: 'text' }>, 'kind' | 'text'>
): void {
  if (text.length > 0) {
    tokens.push({
      kind: 'text',
      text,
      ...options
    })
  }
}

function parseInlineTokens(markdown: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let index = 0

  for (const match of markdown.matchAll(INLINE_TOKEN_PATTERN)) {
    const matchIndex = match.index ?? 0

    pushTextToken(tokens, markdown.slice(index, matchIndex))

    if (match[2] !== undefined && match[3] !== undefined) {
      tokens.push({
        kind: 'image',
        alt: match[2],
        src: match[3]
      })
    } else if (match[4] !== undefined && match[5] !== undefined) {
      tokens.push({
        kind: 'link',
        text: match[4],
        href: match[5]
      })
    } else if (match[6] !== undefined) {
      tokens.push({
        kind: 'link',
        text: match[6],
        href: match[6]
      })
    } else if (match[7] !== undefined) {
      pushTextToken(tokens, match[7], { code: true })
    } else if (match[8] !== undefined) {
      pushTextToken(tokens, match[8], { bold: true })
    } else if (match[9] !== undefined) {
      pushTextToken(tokens, match[9], { bold: true })
    } else if (match[10] !== undefined) {
      pushTextToken(tokens, match[10], { strike: true })
    } else if (match[12] !== undefined) {
      pushTextToken(
        tokens,
        `${match[11] ?? ''}${match[12]}${match[13] ?? ''}`,
        {
          italics: true
        }
      )
    } else if (match[15] !== undefined) {
      pushTextToken(
        tokens,
        `${match[14] ?? ''}${match[15]}${match[16] ?? ''}`,
        {
          italics: true
        }
      )
    }

    index = matchIndex + match[0].length
  }

  pushTextToken(tokens, markdown.slice(index))

  return tokens
}

function getHeadingLevel(
  level: number
): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  if (level <= 1) {
    return HeadingLevel.HEADING_1
  }

  if (level === 2) {
    return HeadingLevel.HEADING_2
  }

  if (level === 3) {
    return HeadingLevel.HEADING_3
  }

  if (level === 4) {
    return HeadingLevel.HEADING_4
  }

  if (level === 5) {
    return HeadingLevel.HEADING_5
  }

  return HeadingLevel.HEADING_6
}

function createTextRun(
  text: string,
  options?: Omit<Extract<InlineToken, { kind: 'text' }>, 'kind' | 'text'>
): TextRun {
  return new TextRun({
    text,
    bold: options?.bold,
    italics: options?.italics,
    strike: options?.strike,
    font: options?.code ? 'Consolas' : undefined,
    shading: options?.code
      ? {
          fill: 'F3F4F6'
        }
      : undefined
  })
}

async function createImageRun(
  token: Extract<InlineToken, { kind: 'image' }>,
  assetResolver: DocxAssetResolver | undefined
): Promise<ImageRun | undefined> {
  const assetPath = assetResolver?.resolveMarkdownUrl(token.src)

  if (!assetPath) {
    return undefined
  }

  const imageType = getDocxImageType(assetPath)

  if (!imageType) {
    return undefined
  }

  const imageBytes = await readFile(assetPath)

  return new ImageRun({
    type: imageType,
    data: imageBytes,
    transformation: {
      width: IMAGE_MAX_WIDTH,
      height: IMAGE_MAX_HEIGHT
    },
    altText: {
      title: token.alt || 'Note image',
      description: token.alt || 'Note image',
      name: token.alt || 'Note image'
    }
  })
}

function getDocxImageType(
  filePath: string
): 'png' | 'jpg' | 'gif' | 'bmp' | undefined {
  const extension = extname(filePath).slice(1).toLowerCase()

  if (extension === 'jpeg') {
    return 'jpg'
  }

  if (
    extension === 'png' ||
    extension === 'jpg' ||
    extension === 'gif' ||
    extension === 'bmp'
  ) {
    return extension
  }

  return undefined
}

async function createInlineChildren(
  text: string,
  assetResolver: DocxAssetResolver | undefined,
  runStyle?: Omit<Extract<InlineToken, { kind: 'text' }>, 'kind' | 'text'>
): Promise<ParagraphChild[]> {
  const children: ParagraphChild[] = []

  for (const token of parseInlineTokens(text)) {
    if (token.kind === 'text') {
      children.push(createTextRun(token.text, { ...token, ...runStyle }))
      continue
    }

    if (token.kind === 'link') {
      children.push(
        new ExternalHyperlink({
          link: token.href,
          children: [
            new TextRun({
              text: token.text,
              color: '2563EB',
              underline: {}
            })
          ]
        })
      )
      continue
    }

    const imageRun = await createImageRun(token, assetResolver)

    children.push(imageRun ?? createTextRun(token.alt || token.src))
  }

  return children.length > 0 ? children : [new TextRun('')]
}

function createParagraph(
  children: readonly ParagraphChild[],
  options?: ConstructorParameters<typeof Paragraph>[0]
): Paragraph {
  return new Paragraph({
    spacing: {
      after: 180
    },
    ...(typeof options === 'object' ? options : {}),
    children
  })
}

function createCodeParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: 'Consolas',
        size: 20
      })
    ],
    shading: {
      fill: 'F3F4F6'
    },
    border: {
      left: {
        style: BorderStyle.SINGLE,
        color: 'D1D5DB',
        size: 8
      }
    },
    spacing: {
      before: 120,
      after: 180
    },
    indent: {
      left: 180
    }
  })
}

function normalizeComparableText(text: string): string {
  return markdownToPlainText(text).replace(/\s+/gu, ' ').trim().toLowerCase()
}

function isDuplicateTitleHeading(note: Note, block: MarkdownBlock): boolean {
  return (
    block.kind === 'heading' &&
    normalizeComparableText(block.text) === normalizeComparableText(note.title)
  )
}

async function createTable(
  block: Extract<MarkdownBlock, { kind: 'table' }>,
  assetResolver: DocxAssetResolver | undefined
): Promise<Table> {
  const columnCount = Math.max(...block.rows.map((row) => row.length), 1)
  const columnWidth = Math.floor(TABLE_WIDTH_TWIPS / columnCount)

  return new Table({
    width: {
      size: TABLE_WIDTH_TWIPS,
      type: WidthType.DXA
    },
    columnWidths: Array.from({ length: columnCount }, () => columnWidth),
    layout: TableLayoutType.FIXED,
    rows: await Promise.all(
      block.rows.map(async (row, rowIndex) => {
        const cells = await Promise.all(
          Array.from({ length: columnCount }, async (_, cellIndex) => {
            const cellText = row[cellIndex] ?? ''

            return new TableCell({
              width: {
                size: columnWidth,
                type: WidthType.DXA
              },
              margins: {
                top: 120,
                bottom: 120,
                left: 120,
                right: 120
              },
              verticalAlign: VerticalAlignTable.CENTER,
              shading:
                rowIndex === 0
                  ? {
                      fill: 'F8FAFC'
                    }
                  : undefined,
              children: [
                new Paragraph({
                  children: await createInlineChildren(cellText, assetResolver),
                  spacing: {
                    after: 0
                  }
                })
              ]
            })
          })
        )

        return new TableRow({
          children: cells,
          tableHeader: rowIndex === 0
        })
      })
    )
  })
}

async function createDocumentChildren(
  note: Note,
  assetResolver: DocxAssetResolver | undefined
): Promise<FileChild[]> {
  const children: FileChild[] = [
    new Paragraph({
      text: note.title,
      heading: HeadingLevel.TITLE,
      spacing: {
        after: 240
      }
    })
  ]

  for (const [blockIndex, block] of parseMarkdownBlocks(
    note.contentMarkdown
  ).entries()) {
    if (blockIndex === 0 && isDuplicateTitleHeading(note, block)) {
      continue
    }

    if (block.kind === 'heading') {
      children.push(
        new Paragraph({
          children: await createInlineChildren(block.text, assetResolver),
          heading: getHeadingLevel(block.level),
          spacing: {
            before: 120,
            after: 160
          }
        })
      )
      continue
    }

    if (block.kind === 'paragraph') {
      children.push(
        createParagraph(await createInlineChildren(block.text, assetResolver))
      )
      continue
    }

    if (block.kind === 'list-item') {
      const prefix =
        block.checked === undefined ? '' : block.checked ? '[x] ' : '[ ] '

      children.push(
        createParagraph(
          await createInlineChildren(`${prefix}${block.text}`, assetResolver),
          {
            numbering: {
              reference: block.ordered
                ? ORDERED_NUMBERING_REFERENCE
                : BULLET_NUMBERING_REFERENCE,
              level: 0
            }
          }
        )
      )
      continue
    }

    if (block.kind === 'quote') {
      children.push(
        createParagraph(
          await createInlineChildren(block.text, assetResolver, {
            italics: true
          }),
          {
            border: {
              left: {
                style: BorderStyle.SINGLE,
                color: 'CBD5E1',
                size: 8
              }
            },
            indent: {
              left: 220
            }
          }
        )
      )
      continue
    }

    if (block.kind === 'code') {
      for (const line of block.text.split('\n')) {
        children.push(createCodeParagraph(line))
      }
      continue
    }

    children.push(await createTable(block, assetResolver))
  }

  return children
}

function createNumbering() {
  return {
    config: [
      {
        reference: BULLET_NUMBERING_REFERENCE,
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022',
            alignment: AlignmentType.LEFT,
            suffix: LevelSuffix.TAB,
            style: {
              paragraph: {
                indent: {
                  left: 720,
                  hanging: 360
                }
              }
            }
          }
        ]
      },
      {
        reference: ORDERED_NUMBERING_REFERENCE,
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
            alignment: AlignmentType.LEFT,
            suffix: LevelSuffix.TAB,
            style: {
              paragraph: {
                indent: {
                  left: 720,
                  hanging: 360
                }
              }
            }
          }
        ]
      }
    ]
  }
}

export async function exportDocxNote({
  note,
  filePath,
  assetResolver
}: ExportDocxNoteInput): Promise<ExportNoteResult> {
  const document = new Document({
    title: note.title,
    creator: 'Windows Memo',
    description: 'Exported Windows Memo note',
    numbering: createNumbering(),
    styles: {
      default: {
        document: {
          run: {
            font: 'Aptos',
            size: 22
          },
          paragraph: {
            spacing: {
              line: 276
            }
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: DOCUMENT_MARGIN_TWIPS,
              right: DOCUMENT_MARGIN_TWIPS,
              bottom: DOCUMENT_MARGIN_TWIPS,
              left: DOCUMENT_MARGIN_TWIPS
            }
          }
        },
        children: await createDocumentChildren(note, assetResolver)
      }
    ]
  })

  await writeFile(filePath, await Packer.toBuffer(document))

  return {
    status: 'exported',
    filePath,
    format: 'docx'
  }
}
