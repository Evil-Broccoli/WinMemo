import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownPreview } from '../src/renderer/components/MarkdownPreview'
import { transformPreviewUrl } from '../src/renderer/markdown/preview-url'

const assetUrl =
  'windows-memo-asset://local/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png'

test('renders common Markdown syntax and GitHub-flavored tables', () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownPreview, {
      contentMarkdown: [
        '# Daily capture',
        '',
        '- First item',
        '- Second item',
        '',
        '> Keep this visible.',
        '',
        '```ts',
        'const answer = 42',
        '```',
        '',
        '[Open docs](https://example.com/docs)',
        '',
        '![Reference image](https://example.com/reference.png)',
        '',
        '| Name | State |',
        '| --- | --- |',
        '| Preview | Ready |'
      ].join('\n')
    })
  )

  assert.match(html, /<h1>Daily capture<\/h1>/)
  assert.match(html, /<ul>/)
  assert.match(html, /<blockquote>/)
  assert.match(html, /<pre><code class="language-ts">/)
  assert.match(html, /href="https:\/\/example.com\/docs"/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /src="https:\/\/example.com\/reference.png"/)
  assert.match(html, /alt="Reference image"/)
  assert.match(html, /<table>/)
})

test('keeps managed image URLs while filtering unsafe protocols', () => {
  assert.equal(
    transformPreviewUrl(assetUrl, 'src', {
      type: 'element',
      tagName: 'img',
      properties: {},
      children: []
    }),
    assetUrl
  )
  assert.equal(
    transformPreviewUrl('javascript:alert(1)', 'href', {
      type: 'element',
      tagName: 'a',
      properties: {},
      children: []
    }),
    ''
  )
})

test('does not render raw HTML embedded in note content', () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownPreview, {
      contentMarkdown: "<script>alert('unsafe')</script>"
    })
  )

  assert.doesNotMatch(html, /<script>/)
  assert.doesNotMatch(html, /alert/)
})
