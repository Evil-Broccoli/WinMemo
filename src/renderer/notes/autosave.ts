export const AUTOSAVE_DELAY_MS = 650

export interface AutosaveScheduler<Value> {
  readonly setSave: (save: (value: Value) => Promise<void>) => void
  readonly schedule: (value: Value) => void
  readonly flush: () => Promise<void>
  readonly discard: () => void
  readonly waitForIdle: () => Promise<void>
  readonly hasPending: () => boolean
  readonly hasUnsavedChanges: () => boolean
}

export function createAutosaveScheduler<Value>(
  initialSave: (value: Value) => Promise<void>,
  delayMs = AUTOSAVE_DELAY_MS
): AutosaveScheduler<Value> {
  let save = initialSave
  let pendingValue: Value | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let saveQueue = Promise.resolve()
  let queuedSaveCount = 0

  const clearScheduledSave = (): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
  }

  const enqueueSave = (value: Value): Promise<void> => {
    queuedSaveCount += 1

    const queuedSave = saveQueue.then(() => save(value))
    const trackedSave = queuedSave.finally(() => {
      queuedSaveCount -= 1
    })

    saveQueue = trackedSave.catch(() => undefined)

    return trackedSave.catch((error: unknown) => {
      pendingValue ??= value
      throw error
    })
  }

  const savePending = async (): Promise<void> => {
    clearScheduledSave()

    if (pendingValue === undefined) {
      await saveQueue
      return
    }

    const value = pendingValue

    pendingValue = undefined
    await enqueueSave(value)
  }

  return {
    setSave: (nextSave) => {
      save = nextSave
    },
    schedule: (value) => {
      pendingValue = value
      clearScheduledSave()
      timeoutId = setTimeout(() => {
        void savePending().catch(() => undefined)
      }, delayMs)
    },
    flush: async () => {
      clearScheduledSave()

      while (true) {
        if (pendingValue !== undefined) {
          await savePending()
          clearScheduledSave()
          continue
        }

        await saveQueue

        if (pendingValue === undefined) {
          return
        }

        clearScheduledSave()
      }
    },
    discard: () => {
      pendingValue = undefined
      clearScheduledSave()
    },
    waitForIdle: () => saveQueue,
    hasPending: () => pendingValue !== undefined,
    hasUnsavedChanges: () => pendingValue !== undefined || queuedSaveCount > 0
  }
}
