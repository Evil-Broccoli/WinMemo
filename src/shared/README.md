# Shared Domain Contracts

The modules in this directory define serializable contracts shared by the
Electron main process, preload bridge, and React renderer.

## Notes

- `Note` is the canonical persisted note shape.
- `NoteSummary` is the lightweight list shape for sidebar queries.
- `NoteCreateInput` accepts optional values because the repository supplies
  defaults for a blank note.
- `NoteUpdateInput` requires an `id` and at least one mutable field.
- Note IDs, timestamps, previews, and source types are controlled by the data
  layer rather than renderer update payloads.
- Blank titles fall back to the first readable content line or `Untitled note`.
- An existing custom title is preserved when note content changes.
- `sourceType` is one of `note`, `imported`, or `quick-note`.

## Documents

Document format values omit the leading dot: `txt`, `md`, and `docx`.
Legacy `doc` files are intentionally unsupported and should produce a clear
conversion message.

## Assets

`AssetReference.markdownUrl` is the stable, app-managed URL inserted into note
Markdown. Renderers must not persist external source paths as asset references.
Image bytes cross the preload bridge as `Uint8Array`; renderer code never
receives unrestricted filesystem access.

Managed Markdown image URLs use this form:

```text
windows-memo-asset://local/<sha256>.<extension>
```

The main process resolves only canonical URLs inside `<Electron userData>/assets`.
Missing files return no resolved path so preview rendering can fall back to alt
text or a missing-image placeholder.

## Quick Notes

`QuickNoteDraft.alwaysOnTop` describes floating-window behavior. It is separate
from `Note.pinned`, which is reserved for future main-list pinning behavior.

## Results

Cross-layer operations should use `AppResult<Value>` when a user-visible
failure is possible. Error details must remain serializable.

## IPC Bridge

Renderer code uses the single `window.desktop` preload bridge. It must not
import Electron or call `ipcRenderer` directly.

Invoke channels use the `domain:action-name` pattern. Domain names and actions
are lowercase, actions use kebab-case, and a channel owns one serializable
request and response shape. Main-process handlers must validate incoming
payloads before passing them to services.

The current draft exposes:

- `notes.list()`, `notes.get(id)`, `notes.create(input)`,
  `notes.update(input)`, and `notes.delete(id)`
- `documents.importNotes()` and `documents.exportNote(input)`
- `assets.saveImage(input)`
- `quickNote.open()`, `quickNote.save(input)`,
  `quickNote.respondToClose(input)`, and `quickNote.onCloseRequested(listener)`
- `window.getState()` and `window.setAlwaysOnTop(enabled)`

Native import and export dialog cancellations return `status: 'cancelled'`
rather than an application error. Window state APIs operate on the sending
renderer window; renderers cannot target an arbitrary Electron window ID.
