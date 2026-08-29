import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/500-italic.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import './index.css'
import App from './App.tsx'

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[]
  }
}

// Excalidraw fetches its fonts lazily and defaults to a CDN, which a
// local-first desktop app can't depend on. Point it at the copy the
// `excalidraw-assets` Vite plugin serves in dev and bundles on build.
window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
