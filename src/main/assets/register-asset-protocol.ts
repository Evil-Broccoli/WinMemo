import { protocol } from 'electron'
import type { AssetStorageService } from './asset-storage'
import { createAssetProtocolResponse } from './asset-protocol'

export const ASSET_PROTOCOL_SCHEME = 'windows-memo-asset'

export function registerAssetProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_PROTOCOL_SCHEME,
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true
      }
    }
  ])
}

export function registerAssetProtocolHandler(
  storage: AssetStorageService
): () => void {
  protocol.handle(ASSET_PROTOCOL_SCHEME, (request) =>
    createAssetProtocolResponse(storage, request.url)
  )

  return () => {
    protocol.unhandle(ASSET_PROTOCOL_SCHEME)
  }
}
