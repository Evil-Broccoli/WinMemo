import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QuickNoteApp } from './QuickNoteApp'
import './styles.css'

document.body.classList.add('quick-note-body')

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Quick note renderer root element was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <QuickNoteApp />
  </StrictMode>
)
