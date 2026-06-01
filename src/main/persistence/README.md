# Persistence Bootstrap

Windows Memo uses the `node:sqlite` module bundled with Electron's Node
runtime. This avoids a separate native SQLite dependency and keeps database
access inside the Electron main process.

The database file is created at:

```text
<Electron userData>/windows-memo.sqlite3
```

For isolated development and QA runs, set `WINDOWS_MEMO_USER_DATA_PATH` to
override the default Electron user-data directory.

After an isolated startup, validate the generated v1 schema with Electron's
Node runtime:

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
.\node_modules\electron\dist\electron.exe scripts\verify-database.mjs <database-path>
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

## V1 Migration Strategy

- `PRAGMA user_version` stores the applied schema version.
- Migrations are append-only and run in ascending version order.
- Each migration runs inside its own transaction.
- Startup fails before opening the main window if migration cannot complete.
- A database created by a newer application version is rejected rather than
  opened with an older schema implementation.

The initial migration creates the `notes` table and an index for sorting by
`updated_at`.

## Note Repository

`note-repository.ts` provides the main-process note data access layer:

- create, list, get, update, and delete operations
- ISO timestamp generation for created and updated notes
- summary sorting by most recent update time
- preview-text generation from Markdown content
- fallback title derivation from the first readable content line

Run the repository coverage with Electron's bundled Node runtime:

```powershell
npm run test:repository
```
