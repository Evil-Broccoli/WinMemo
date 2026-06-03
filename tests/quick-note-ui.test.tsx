import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  QuickNoteApp,
  QuickNoteClosePrompt
} from '../src/renderer/QuickNoteApp'
import { hasSavableQuickNoteDraft } from '../src/renderer/quick-note-draft'

test('renders the quick-note editor shell with a pin action', () => {
  const html = renderToStaticMarkup(createElement(QuickNoteApp))

  assert.match(html, /aria-label="Quick note window"/)
  assert.match(html, /aria-label="Quick note content"/)
  assert.match(html, /placeholder="Start typing\.\.\."/)
  assert.match(html, /aria-label="Pin quick note"/)
  assert.match(html, /aria-pressed="false"/)
  assert.match(html, />Draft</)
  assert.match(html, />Unpinned</)
  assert.match(html, />0 chars</)
})

test('renders the quick-note close prompt with save discard and cancel actions', () => {
  const html = renderToStaticMarkup(
    createElement(QuickNoteClosePrompt, {
      characterCount: 14,
      errorMessage: '',
      pendingAction: undefined,
      onSave: () => undefined,
      onDiscard: () => undefined,
      onCancel: () => undefined
    })
  )

  assert.match(html, /role="alertdialog"/)
  assert.match(html, />Save quick note\?</)
  assert.match(html, />Save</)
  assert.match(html, />Discard</)
  assert.match(html, />Cancel</)
})

test('renders quick-note close errors without hiding the choices', () => {
  const html = renderToStaticMarkup(
    createElement(QuickNoteClosePrompt, {
      characterCount: 14,
      errorMessage: 'Unable to access the local notes database.',
      pendingAction: 'save',
      onSave: () => undefined,
      onDiscard: () => undefined,
      onCancel: () => undefined
    })
  )

  assert.match(html, /role="alert"/)
  assert.match(html, /Unable to access the local notes database\./)
  assert.match(html, />Saving</)
  assert.match(html, />Discard</)
  assert.match(html, />Cancel</)
})

test('treats whitespace-only quick-note drafts as not savable', () => {
  assert.equal(hasSavableQuickNoteDraft(''), false)
  assert.equal(hasSavableQuickNoteDraft('   \n\t'), false)
  assert.equal(hasSavableQuickNoteDraft('Capture this'), true)
})
