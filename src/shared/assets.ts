export type AssetId = string

export interface SaveImageAssetInput {
  readonly fileName: string
  readonly mimeType: string
  readonly bytes: Uint8Array
}

export interface AssetReference {
  readonly id: AssetId
  readonly fileName: string
  readonly mimeType: string
  readonly markdownUrl: string
}
