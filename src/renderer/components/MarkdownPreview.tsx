import React, {
  Component,
  memo,
  useDeferredValue,
  useState,
  type ComponentProps,
  type ReactNode
} from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { transformPreviewUrl } from '../markdown/preview-url'

interface MarkdownPreviewProps {
  readonly contentMarkdown: string
}

interface PreviewErrorBoundaryProps {
  readonly contentMarkdown: string
  readonly children: ReactNode
}

interface PreviewErrorBoundaryState {
  readonly contentMarkdown: string
  readonly hasError: boolean
}

const markdownComponents = {
  a({ children, href, title }: ComponentProps<'a'>) {
    return (
      <a href={href} rel="noreferrer" target="_blank" title={title}>
        {children}
      </a>
    )
  },
  img({ alt, src, title }: ComponentProps<'img'>) {
    return <PreviewImage alt={alt} src={src} title={title} />
  }
} satisfies Components

function PreviewImage({
  alt,
  src,
  title
}: ComponentProps<'img'>): React.JSX.Element {
  const [failedSource, setFailedSource] = useState<string>()

  return src && failedSource !== src ? (
    <img
      alt={alt ?? ''}
      loading="lazy"
      src={src}
      title={title}
      onError={() => setFailedSource(src)}
    />
  ) : (
    <span className="markdown-preview-image-fallback">
      {alt || 'Image unavailable'}
    </span>
  )
}

class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  public override state: PreviewErrorBoundaryState = {
    contentMarkdown: this.props.contentMarkdown,
    hasError: false
  }

  public static getDerivedStateFromError(): Partial<PreviewErrorBoundaryState> {
    return { hasError: true }
  }

  public static getDerivedStateFromProps(
    props: PreviewErrorBoundaryProps,
    state: PreviewErrorBoundaryState
  ): Partial<PreviewErrorBoundaryState> | null {
    return props.contentMarkdown === state.contentMarkdown
      ? null
      : { contentMarkdown: props.contentMarkdown, hasError: false }
  }

  public override render(): ReactNode {
    return this.state.hasError ? (
      <div className="markdown-preview-message" role="status">
        <strong>Preview unavailable</strong>
        <span>Keep editing and the preview will retry automatically.</span>
      </div>
    ) : (
      this.props.children
    )
  }
}

function MarkdownPreviewComponent({
  contentMarkdown
}: MarkdownPreviewProps): React.JSX.Element {
  const deferredContentMarkdown = useDeferredValue(contentMarkdown)

  if (!contentMarkdown.trim()) {
    return (
      <div className="markdown-preview-message">
        <strong>Nothing to preview yet</strong>
        <span>Markdown formatting will appear here as you write.</span>
      </div>
    )
  }

  return (
    <div
      aria-busy={deferredContentMarkdown !== contentMarkdown}
      className="markdown-preview-scroll"
    >
      <article className="markdown-preview-content">
        <PreviewErrorBoundary contentMarkdown={deferredContentMarkdown}>
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={[remarkGfm]}
            skipHtml
            urlTransform={transformPreviewUrl}
          >
            {deferredContentMarkdown}
          </ReactMarkdown>
        </PreviewErrorBoundary>
      </article>
    </div>
  )
}

export const MarkdownPreview = memo(MarkdownPreviewComponent)

MarkdownPreview.displayName = 'MarkdownPreview'
