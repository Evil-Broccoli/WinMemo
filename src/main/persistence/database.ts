import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { migrateDatabase } from './migrations'

export const DATABASE_FILE_NAME = 'windows-memo.sqlite3'

let database: DatabaseSync | undefined

export function getDatabasePath(userDataPath: string): string {
  return join(userDataPath, DATABASE_FILE_NAME)
}

export function initializeDatabase(databasePath: string): DatabaseSync {
  if (database) {
    return database
  }

  mkdirSync(dirname(databasePath), { recursive: true })

  const nextDatabase = new DatabaseSync(databasePath, {
    allowExtension: false,
    defensive: true,
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    timeout: 5_000
  })

  try {
    nextDatabase.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `)
    migrateDatabase(nextDatabase)
  } catch (error) {
    nextDatabase.close()
    throw error
  }

  database = nextDatabase

  return database
}

export function getDatabase(): DatabaseSync {
  if (!database) {
    throw new Error('Database has not been initialized.')
  }

  return database
}

export function closeDatabase(): void {
  database?.close()
  database = undefined
}
