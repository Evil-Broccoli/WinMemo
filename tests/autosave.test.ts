import assert from 'node:assert/strict'
import test from 'node:test'
import { createAutosaveScheduler } from '../src/renderer/notes/autosave'

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

test('debounces rapid autosave schedules to the latest value', async () => {
  const savedValues: string[] = []
  const scheduler = createAutosaveScheduler(async (value: string) => {
    savedValues.push(value)
  }, 10)

  scheduler.schedule('first draft')
  scheduler.schedule('latest draft')

  assert.deepEqual(savedValues, [])
  assert.equal(scheduler.hasUnsavedChanges(), true)

  await wait(25)
  await scheduler.waitForIdle()

  assert.deepEqual(savedValues, ['latest draft'])
  assert.equal(scheduler.hasUnsavedChanges(), false)
})

test('flushes a pending autosave immediately before the debounce delay', async () => {
  const savedValues: string[] = []
  const scheduler = createAutosaveScheduler(async (value: string) => {
    savedValues.push(value)
  }, 10_000)

  scheduler.schedule('save before switching')
  await scheduler.flush()

  assert.deepEqual(savedValues, ['save before switching'])
  assert.equal(scheduler.hasPending(), false)
  assert.equal(scheduler.hasUnsavedChanges(), false)
})

test('keeps a failed autosave pending so a later flush can retry it', async () => {
  const savedValues: string[] = []
  let attempts = 0
  const scheduler = createAutosaveScheduler(async (value: string) => {
    attempts += 1

    if (attempts === 1) {
      throw new Error('storage offline')
    }

    savedValues.push(value)
  }, 10_000)

  scheduler.schedule('retry this draft')

  await assert.rejects(scheduler.flush(), /storage offline/)

  assert.equal(scheduler.hasPending(), true)

  await scheduler.flush()

  assert.deepEqual(savedValues, ['retry this draft'])
  assert.equal(scheduler.hasPending(), false)
})

test('discards an autosave that is no longer needed', async () => {
  const savedValues: string[] = []
  const scheduler = createAutosaveScheduler(async (value: string) => {
    savedValues.push(value)
  }, 10)

  scheduler.schedule('discard this draft')
  scheduler.discard()

  await wait(25)

  assert.deepEqual(savedValues, [])
  assert.equal(scheduler.hasUnsavedChanges(), false)
})
