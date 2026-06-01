import { DatabaseSync } from 'node:sqlite'

const databasePath = process.argv[2]

if (!databasePath) {
  throw new Error('Usage: electron scripts/verify-database.mjs <database-path>')
}

const database = new DatabaseSync(databasePath, { readOnly: true })

try {
  const version = database.prepare('PRAGMA user_version').get()?.user_version
  const table = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes'"
    )
    .get()?.name
  const index = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'notes_updated_at_index'"
    )
    .get()?.name

  if (
    version !== 1 ||
    table !== 'notes' ||
    index !== 'notes_updated_at_index'
  ) {
    throw new Error('SQLite schema does not match the expected v1 structure.')
  }

  console.log(
    JSON.stringify(
      {
        databasePath,
        index,
        node: process.versions.node,
        table,
        version
      },
      null,
      2
    )
  )
} finally {
  database.close()
}
