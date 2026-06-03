import assert from 'node:assert/strict'
import test from 'node:test'
import {
  QUICK_NOTE_SHORTCUT_ACCELERATORS,
  registerQuickNoteGlobalShortcut
} from '../src/main/shortcuts/global-shortcut'
import type { GlobalShortcutRegistrar } from '../src/main/shortcuts/global-shortcut'

const PRIMARY_SHORTCUT = QUICK_NOTE_SHORTCUT_ACCELERATORS[0]
const FALLBACK_SHORTCUT = QUICK_NOTE_SHORTCUT_ACCELERATORS[1]

function createRegistrar(
  options: {
    readonly results?: readonly boolean[]
    readonly throwOnAttempts?: readonly number[]
  } = {}
) {
  const attempts: string[] = []
  const callbacks = new Map<string, () => void>()
  const unregistered: string[] = []
  const throwOnAttempts = new Set(options.throwOnAttempts ?? [])

  const registrar: GlobalShortcutRegistrar = {
    register: (accelerator, callback) => {
      const attemptIndex = attempts.length

      attempts.push(accelerator)

      if (throwOnAttempts.has(attemptIndex)) {
        throw new Error('shortcut denied')
      }

      const result = options.results?.[attemptIndex] ?? true

      if (result) {
        callbacks.set(accelerator, callback)
      }

      return result
    },
    unregister: (accelerator) => {
      unregistered.push(accelerator)
      callbacks.delete(accelerator)
    }
  }

  return {
    attempts,
    callbacks,
    registrar,
    unregistered
  }
}

function callRegisteredShortcut(
  callbacks: ReadonlyMap<string, () => void>,
  accelerator: string
): void {
  const callback = callbacks.get(accelerator)

  if (!callback) {
    assert.fail(`Shortcut "${accelerator}" was not registered.`)
  }

  callback()
}

test('registers the primary quick-note shortcut and opens the quick note window', () => {
  const { attempts, callbacks, registrar, unregistered } = createRegistrar()
  const warnings: string[] = []
  let openCount = 0

  const registration = registerQuickNoteGlobalShortcut({
    registrar,
    quickNoteWindow: {
      open: () => {
        openCount += 1

        return {
          id: 20,
          kind: 'quick-note',
          alwaysOnTop: false
        }
      }
    },
    logger: {
      warn: (message) => warnings.push(message)
    }
  })

  assert.equal(registration.registered, true)
  assert.equal(registration.accelerator, PRIMARY_SHORTCUT)
  assert.deepEqual(attempts, [PRIMARY_SHORTCUT])
  assert.deepEqual(warnings, [])

  callRegisteredShortcut(callbacks, PRIMARY_SHORTCUT)

  assert.equal(openCount, 1)

  registration.dispose()

  assert.deepEqual(unregistered, [PRIMARY_SHORTCUT])
})

test('falls back to the secondary shortcut when the primary is unavailable', () => {
  const { attempts, callbacks, registrar } = createRegistrar({
    results: [false, true]
  })
  const warnings: string[] = []
  let openCount = 0

  const registration = registerQuickNoteGlobalShortcut({
    registrar,
    quickNoteWindow: {
      open: () => {
        openCount += 1

        return {
          id: 21,
          kind: 'quick-note',
          alwaysOnTop: false
        }
      }
    },
    logger: {
      warn: (message) => warnings.push(message)
    }
  })

  assert.equal(registration.registered, true)
  assert.equal(registration.accelerator, FALLBACK_SHORTCUT)
  assert.deepEqual(attempts, [PRIMARY_SHORTCUT, FALLBACK_SHORTCUT])
  assert.deepEqual(warnings, [
    `Quick note shortcut "${PRIMARY_SHORTCUT}" is unavailable.`
  ])

  callRegisteredShortcut(callbacks, FALLBACK_SHORTCUT)

  assert.equal(openCount, 1)
})

test('continues to fallback shortcuts when registration throws', () => {
  const { attempts, registrar } = createRegistrar({
    throwOnAttempts: [0]
  })
  const warnings: string[] = []

  const registration = registerQuickNoteGlobalShortcut({
    registrar,
    quickNoteWindow: {
      open: () => ({
        id: 22,
        kind: 'quick-note',
        alwaysOnTop: false
      })
    },
    logger: {
      warn: (message) => warnings.push(message)
    }
  })

  assert.equal(registration.registered, true)
  assert.equal(registration.accelerator, FALLBACK_SHORTCUT)
  assert.deepEqual(attempts, [PRIMARY_SHORTCUT, FALLBACK_SHORTCUT])
  assert.deepEqual(warnings, [
    `Quick note shortcut "${PRIMARY_SHORTCUT}" could not be registered.`
  ])
})

test('returns a no-op registration when all shortcuts fail', () => {
  const { attempts, callbacks, registrar, unregistered } = createRegistrar({
    results: [false, false]
  })
  const warnings: string[] = []

  const registration = registerQuickNoteGlobalShortcut({
    registrar,
    quickNoteWindow: {
      open: () => ({
        id: 23,
        kind: 'quick-note',
        alwaysOnTop: false
      })
    },
    logger: {
      warn: (message) => warnings.push(message)
    }
  })

  assert.equal(registration.registered, false)
  assert.equal(registration.accelerator, undefined)
  assert.deepEqual(attempts, [PRIMARY_SHORTCUT, FALLBACK_SHORTCUT])
  assert.equal(callbacks.size, 0)

  registration.dispose()

  assert.deepEqual(unregistered, [])
  assert.deepEqual(warnings, [
    `Quick note shortcut "${PRIMARY_SHORTCUT}" is unavailable.`,
    `Quick note shortcut "${FALLBACK_SHORTCUT}" is unavailable.`,
    'Quick note global shortcut registration failed. Use the Quick note button to open quick capture.'
  ])
})

test('keeps the shortcut registered when opening the quick note window fails', () => {
  const { callbacks, registrar, unregistered } = createRegistrar()
  const warnings: string[] = []
  const registration = registerQuickNoteGlobalShortcut({
    registrar,
    quickNoteWindow: {
      open: () => {
        throw new Error('window manager failed')
      }
    },
    logger: {
      warn: (message) => warnings.push(message)
    }
  })

  assert.doesNotThrow(() => callRegisteredShortcut(callbacks, PRIMARY_SHORTCUT))
  assert.deepEqual(warnings, [
    'Unable to open the quick note window from the shortcut.'
  ])

  registration.dispose()

  assert.deepEqual(unregistered, [PRIMARY_SHORTCUT])
})
