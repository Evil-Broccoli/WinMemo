import { defaultUrlTransform, type UrlTransform } from 'react-markdown'

const MANAGED_ASSET_URL_PATTERN =
  /^windows-memo-asset:\/\/local\/[a-f0-9]{64}\.(?:png|jpe?g|gif|webp)$/i

export const transformPreviewUrl: UrlTransform = (url, key, node) => {
  if (
    key === 'src' &&
    node.tagName === 'img' &&
    MANAGED_ASSET_URL_PATTERN.test(url)
  ) {
    return url
  }

  return defaultUrlTransform(url)
}
