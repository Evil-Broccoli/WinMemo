import type { DatabaseSync } from 'node:sqlite'

interface DatabaseMigration {
  readonly version: number
  readonly migrate: (database: DatabaseSync) => void
}

const migrations: readonly DatabaseMigration[] = [
  {
    version: 1,
    migrate: (database) => {
      database.exec(`
        CREATE TABLE notes (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          content_markdown TEXT NOT NULL,
          preview_text TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
          source_type TEXT NOT NULL DEFAULT 'note'
            CHECK (source_type IN ('note', 'imported', 'quick-note'))
        ) STRICT;

        CREATE INDEX notes_updated_at_index
          ON notes (updated_at DESC);
      `)
    }
  }
]

const latestSchemaVersion = migrations.at(-1)?.version ?? 0

function readSchemaVersion(database: DatabaseSync): number {
  const result = database.prepare('PRAGMA user_version').get()
  const version = result?.user_version

  if (typeof version !== 'number') {
    throw new Error('Unable to read SQLite schema version.')
  }

  return version
}

export function migrateDatabase(database: DatabaseSync): void {
  const currentVersion = readSchemaVersion(database)

  if (currentVersion > latestSchemaVersion) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than supported version ${latestSchemaVersion}.`
    )
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue
    }

    database.exec('BEGIN IMMEDIATE')

    try {
      migration.migrate(database)
      database.exec(`PRAGMA user_version = ${migration.version}`)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }
}
