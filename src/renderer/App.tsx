import { APP_NAME } from '@shared/constants'

export function App(): React.JSX.Element {
  const platform = window.desktop?.platform ?? 'browser-preview'

  return (
    <main className="app-shell">
      <section className="placeholder-card" aria-labelledby="app-title">
        <p className="eyebrow">Desktop scaffold ready</p>
        <h1 id="app-title">{APP_NAME}</h1>
        <p className="description">
          Electron, React, TypeScript, and Vite are connected. The note
          workspace will grow here in the next tasks.
        </p>
        <dl className="runtime-details">
          <div>
            <dt>Renderer</dt>
            <dd>React</dd>
          </div>
          <div>
            <dt>Desktop shell</dt>
            <dd>Electron</dd>
          </div>
          <div>
            <dt>Platform</dt>
            <dd>{platform}</dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
