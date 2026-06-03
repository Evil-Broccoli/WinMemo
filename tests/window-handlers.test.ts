import assert from 'node:assert/strict'
import test from 'node:test'
import { createWindowHandlers } from '../src/main/windows/window-handlers'
import type { DesktopWindowKind } from '../src/shared/desktop'

function createWindow(id: number) {
  let alwaysOnTop = false

  return {
    id,
    isAlwaysOnTop: () => alwaysOnTop,
    setAlwaysOnTop: (enabled: boolean) => {
      alwaysOnTop = enabled
    }
  }
}

test('returns the current desktop window state', () => {
  const window = createWindow(41)
  const handlers = createWindowHandlers({
    getKind: () => 'quick-note'
  })

  assert.deepEqual(handlers.getState(window), {
    ok: true,
    value: {
      id: 41,
      kind: 'quick-note',
      alwaysOnTop: false
    }
  })
})

test('sets always-on-top on the current desktop window', () => {
  const window = createWindow(42)
  const changes: unknown[] = []
  const handlers = createWindowHandlers({
    getKind: () => 'quick-note',
    onAlwaysOnTopChanged: (state) => changes.push(state)
  })

  assert.deepEqual(handlers.setAlwaysOnTop(window, { enabled: true }), {
    ok: true,
    value: {
      id: 42,
      kind: 'quick-note',
      alwaysOnTop: true
    }
  })
  assert.equal(window.isAlwaysOnTop(), true)
  assert.deepEqual(changes, [
    {
      id: 42,
      kind: 'quick-note',
      alwaysOnTop: true
    }
  ])
})

test('rejects malformed always-on-top payloads', () => {
  const window = createWindow(43)
  const handlers = createWindowHandlers({
    getKind: () => 'quick-note'
  })

  assert.deepEqual(handlers.setAlwaysOnTop(window, { enabled: 'yes' }), {
    ok: false,
    error: {
      code: 'validation-failed',
      message: 'A valid always-on-top setting is required.'
    }
  })
  assert.deepEqual(handlers.setAlwaysOnTop(window, { enabled: true, x: 1 }), {
    ok: false,
    error: {
      code: 'validation-failed',
      message: 'A valid always-on-top setting is required.'
    }
  })
})

test('rejects unregistered desktop windows', () => {
  const window = createWindow(44)
  const handlers = createWindowHandlers({
    getKind: (): DesktopWindowKind | undefined => undefined
  })

  assert.deepEqual(handlers.getState(window), {
    ok: false,
    error: {
      code: 'unknown',
      message: 'Unable to identify this desktop window.'
    }
  })
})
