export const APP_ERROR_CODES = [
  'validation-failed',
  'not-found',
  'unsupported-format',
  'file-read-failed',
  'file-write-failed',
  'database-failed',
  'asset-save-failed',
  'unknown'
] as const

export type AppErrorCode = (typeof APP_ERROR_CODES)[number]

export interface AppError {
  readonly code: AppErrorCode
  readonly message: string
  readonly details?: Readonly<Record<string, unknown>>
}

export type AppResult<Value> =
  | {
      readonly ok: true
      readonly value: Value
    }
  | {
      readonly ok: false
      readonly error: AppError
    }

export type EmptyResult = AppResult<void>
