# Managed Image Assets

Windows Memo copies inserted raster images into an app-managed directory:

```text
<Electron userData>/assets/
```

`AssetStorageService` keeps renderer input away from unrestricted filesystem
access:

- accepts PNG, JPEG, GIF, and WebP image bytes
- verifies that bytes match the declared MIME type
- rejects empty images and images larger than 20 MiB
- derives asset IDs from the SHA-256 hash of image bytes
- stores one file per unique image as `<sha256>.<extension>`
- normalizes display file names without using them as storage paths

## Markdown References

Notes store managed image references in this form:

```text
windows-memo-asset://local/<sha256>.<extension>
```

The preview protocol handler resolves URLs through
`AssetStorageService.resolveMarkdownUrl()`. It does not translate arbitrary
renderer URLs into filesystem paths.

If the asset URL is invalid, the file is missing, or the managed path is no
longer a regular file, the resolver returns `undefined`. Preview rendering
degrades to alt text or a missing-image placeholder without crashing.

## Renderer Insertion

The Markdown editor accepts pasted or dropped PNG, JPEG, GIF, and WebP files.
It sends bytes through the typed `assets.saveImage()` preload API and inserts
the returned managed URL into note Markdown. Renderer code never receives an
external file path or a managed asset directory path.
