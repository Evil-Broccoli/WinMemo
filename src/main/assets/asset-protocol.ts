import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import type { AssetStorageService } from './asset-storage'

const ASSET_CONTENT_TYPES = {
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
} as const

function notFoundResponse(): Response {
  return new Response(undefined, { status: 404 })
}

export function createAssetProtocolResponse(
  storage: Pick<AssetStorageService, 'resolveMarkdownUrl'>,
  markdownUrl: string
): Response {
  const storedFilePath = storage.resolveMarkdownUrl(markdownUrl)

  if (!storedFilePath) {
    return notFoundResponse()
  }

  const contentType =
    ASSET_CONTENT_TYPES[
      extname(storedFilePath) as keyof typeof ASSET_CONTENT_TYPES
    ]

  if (!contentType) {
    return notFoundResponse()
  }

  try {
    return new Response(readFileSync(storedFilePath), {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': contentType
      }
    })
  } catch {
    return notFoundResponse()
  }
}
