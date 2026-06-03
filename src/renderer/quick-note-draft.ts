export function hasSavableQuickNoteDraft(contentMarkdown: string): boolean {
  return contentMarkdown.trim().length > 0
}
