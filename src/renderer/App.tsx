import { AppSidebar } from './components/AppSidebar'
import { WorkspaceShell } from './components/WorkspaceShell'
import { useNoteList } from './notes/useNoteList'

export function App(): React.JSX.Element {
  const noteList = useNoteList()

  const openQuickNote = (): void => {
    void (async () => {
      const result = await window.desktop?.quickNote.open()

      if (result && !result.ok) {
        window.alert(result.error.message)
      }
    })()
  }

  return (
    <main className="app-shell">
      <AppSidebar
        notes={noteList.visibleNotes}
        noteCount={noteList.notes.length}
        isLoading={noteList.isLoading}
        statusMessage={noteList.statusMessage}
        searchQuery={noteList.searchQuery}
        selectedNoteId={noteList.selectedNoteId}
        onCreateNote={noteList.createNote}
        onImportNotes={noteList.importNotes}
        onOpenQuickNote={openQuickNote}
        onSearchQueryChange={noteList.setSearchQuery}
        onSelectNote={noteList.selectNote}
      />
      <WorkspaceShell
        selectedNote={noteList.selectedNote}
        statusMessage={noteList.statusMessage}
        onCreateNote={noteList.createNote}
        onContentChange={noteList.updateSelectedNoteContent}
        onDeleteNote={noteList.deleteSelectedNote}
        onExportNote={noteList.exportSelectedNote}
      />
    </main>
  )
}
