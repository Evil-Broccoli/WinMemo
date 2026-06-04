import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent
} from 'react'
import {
  getSupportedImageFiles,
  hasFilePayload,
  hasSupportedImagePayload,
  insertImageReferences,
  saveImageFiles
} from '../markdown/image-insertion'

interface MarkdownEditorProps {
  readonly contentMarkdown: string
  readonly onContentChange: (contentMarkdown: string) => void
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to insert this image.'
}

export function MarkdownEditor({
  contentMarkdown,
  onContentChange
}: MarkdownEditorProps): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isMounted = useRef(true)
  const [isDropActive, setIsDropActive] = useState(false)
  const [pendingImageCount, setPendingImageCount] = useState(0)
  const [feedbackMessage, setFeedbackMessage] = useState<string>()

  useEffect(() => {
    isMounted.current = true

    return () => {
      isMounted.current = false
    }
  }, [])

  const insertImages = useCallback(
    async (files: readonly File[]): Promise<void> => {
      const assetsBridge = window.desktop?.assets

      if (!assetsBridge) {
        setFeedbackMessage('Desktop image storage is unavailable.')
        return
      }

      setFeedbackMessage(undefined)
      setPendingImageCount((currentCount) => currentCount + files.length)

      try {
        const references = await saveImageFiles(files, assetsBridge.saveImage)

        if (!isMounted.current) {
          return
        }

        const textarea = textareaRef.current
        const currentMarkdown = textarea?.value ?? contentMarkdown
        const insertion = insertImageReferences(
          currentMarkdown,
          references,
          textarea?.selectionStart ?? currentMarkdown.length,
          textarea?.selectionEnd ?? currentMarkdown.length
        )

        onContentChange(insertion.contentMarkdown)

        requestAnimationFrame(() => {
          const currentTextarea = textareaRef.current

          if (!currentTextarea) {
            return
          }

          currentTextarea.focus()
          currentTextarea.setSelectionRange(
            insertion.cursorPosition,
            insertion.cursorPosition
          )
        })
      } catch (error) {
        if (isMounted.current) {
          setFeedbackMessage(getErrorMessage(error))
        }
      } finally {
        if (isMounted.current) {
          setPendingImageCount((currentCount) =>
            Math.max(0, currentCount - files.length)
          )
        }
      }
    },
    [contentMarkdown, onContentChange]
  )

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const imageFiles = getSupportedImageFiles(event.clipboardData)

    if (imageFiles.length > 0) {
      event.preventDefault()
      void insertImages(imageFiles)
      return
    }

    if (hasFilePayload(event.clipboardData)) {
      event.preventDefault()
      setFeedbackMessage('Paste a PNG, JPEG, GIF, or WebP image.')
    }
  }

  const handleDragOver = (event: DragEvent<HTMLTextAreaElement>): void => {
    if (!hasSupportedImagePayload(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDropActive(true)
  }

  const handleDragLeave = (): void => {
    setIsDropActive(false)
  }

  const handleDrop = (event: DragEvent<HTMLTextAreaElement>): void => {
    if (!hasFilePayload(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    setIsDropActive(false)

    const imageFiles = getSupportedImageFiles(event.dataTransfer)

    if (imageFiles.length === 0) {
      setFeedbackMessage('Drop a PNG, JPEG, GIF, or WebP image.')
      return
    }

    event.currentTarget.focus()
    void insertImages(imageFiles)
  }

  const statusMessage = isDropActive
    ? 'Drop images to insert them into this note.'
    : pendingImageCount > 0
      ? `Saving ${pendingImageCount === 1 ? 'image' : 'images'}...`
      : feedbackMessage

  return (
    <div
      className={`markdown-editor-shell${isDropActive ? ' markdown-editor-shell-drop-active' : ''}`}
    >
      <textarea
        ref={textareaRef}
        className="markdown-editor"
        aria-describedby={
          statusMessage ? 'markdown-editor-image-status' : undefined
        }
        aria-label="Markdown note content"
        placeholder="Start writing in Markdown. Paste or drop images to insert them."
        spellCheck
        value={contentMarkdown}
        onChange={(event) => onContentChange(event.target.value)}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
      />
      {statusMessage ? (
        <p
          className="markdown-editor-image-status"
          id="markdown-editor-image-status"
          role="status"
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  )
}
