# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Extraodev Space" (npm package `extraodev-space`) — a Tauri 2 desktop app for editing local Markdown project folders, with Jira integration, a Mermaid live preview, Excalidraw drawings, an embedded terminal, and lightweight project-management helpers (standups, todos, kanban snapshots). Frontend is React 19 + TypeScript + Tailwind 4; backend is a small Rust Tauri shell.

## Commands

```bash
npm run dev       # Vite dev server only (frontend, no Tauri window)
npm run tauri dev # full app: Rust backend + webview, hot-reloads both
npm run build      # tsc -b && vite build — type-check then bundle frontend
npm run tauri build # produce a distributable desktop app bundle
npm run lint       # oxlint (config in .oxlintrc.json)
npm run preview    # preview a production frontend build
```

There is no test suite configured. Rust code can be checked directly with `cargo check` / `cargo build` from `src-tauri/`.

To run a single lint check on one file: `npx oxlint path/to/file.tsx`.

## Architecture

### Process split

- **Frontend** (`src/`): all UI and app logic lives here. Talks to the OS via Tauri plugins (`@tauri-apps/plugin-fs`, `plugin-dialog`, `plugin-store`) and to two custom Rust commands via `invoke()`.
- **Backend** (`src-tauri/src/`): minimal — three files. `lib.rs` wires up plugins and registers commands; `jira.rs` proxies Jira REST calls (needed because the site's CORS policy blocks direct browser fetches — auth is HTTP Basic with an API token, sent from Rust); `pty.rs` runs a real shell in a pseudo-terminal for the in-app terminal, streaming output to the frontend as base64-encoded `pty-output` events and accepting input via `pty_write`.
- **PTY is a single global session** (`PtyState` holds `Option<PtySession>`, not a map). Spawning a new terminal always kills whatever shell was previously running — there's no per-tab PTY isolation, even though the frontend supports multiple workspace tabs.

### Frontend structure

- `App.tsx` owns **tabs** ("Spaces") — each tab is an independent `Workspace` mounted with its own opened folder. Inactive tabs stay mounted (state + file watchers alive) and are just hidden via CSS, not unmounted; they receive an `active` prop so they can ignore window-global listeners (drag-drop, `⌘P`) while backgrounded. Open tabs persist across launches via `lib/spaces.ts` (Tauri store, `app-state.json`).
- `components/Workspace.tsx` is the hub for one opened folder — nearly all app state (file tree, active file, Jira issues, stash, comments, project config) lives here and is threaded down as props. When adding a workspace-level feature, this is almost always the file that grows. Its `<main>` is a CSS grid whose column template (`documentColumns`) is computed from two independent things: whether the sidebar is hidden (⌘B) and whether the document area holds one pane (a drawing, or preview-only) or the editor/preview pair. The sidebar is hidden with `display: none` rather than unmounted — that keeps the file tree's expansion state and the Jira list alive across toggles, and drops it out of the grid, since `display: none` elements aren't grid items.
- `lib/fileSystem.ts` wraps all filesystem operations (tree building, CRUD, the soft-delete "stash", file watching). The file tree only surfaces directories and the two editable document types, `.md` and `.excalidraw` (`buildTree` filters everything else out, plus dotfiles/`node_modules`/`.git`/`_stash`) — images exported from a drawing sit next to it on disk but stay hidden from the tree on purpose.
- Per-project state is stored as plain files inside the opened folder, not in the Tauri store: `project.json` (name + linked Jira epic), `_comments.json` (inline comments keyed by file's relative path, `lib/comments.ts`), `_stash/` + `_stash/manifest.json` (soft-deleted files, `lib/fileSystem.ts`). App-level state (Jira credentials, recent folders, open tabs) uses `@tauri-apps/plugin-store` instead (`lib/jira.ts`, `lib/recents.ts`, `lib/spaces.ts`).
- `lib/project.ts` also generates content: daily standup files (`standups/YYYY-MM-DD.md`), `TODO.md`, and kanban snapshots (`ticket-status/YYYY-MM-DD.md`, rendered as a Mermaid `kanban` diagram from live Jira epic issues via `generateKanbanFromIssues`). It also converts Jira's rendered-HTML issue descriptions to Markdown via a `TurndownService` instance with **custom rules for tables, code blocks, and inline code** — Jira's HTML doesn't reliably use the semantic tags Turndown's defaults/GFM plugin expect (e.g. tables often lack real `<th>`/`<thead>`), so those rules match loosely by tag/class rather than relying on plugin matching. Extend these rules rather than reaching for the GFM table plugin if new Jira HTML edge cases show up.
- `components/Preview.tsx` + `components/Mermaid.tsx` render the live Markdown preview (`react-markdown` + `remark-gfm` + `rehype-raw`) with Mermaid diagram support and inline comment anchoring.
- `components/SequenceDiagramBuilder.tsx` is a form-based UI that emits Mermaid `sequenceDiagram` syntax, inserted into the editor at cursor.
- **Drawings (Excalidraw)**: a `.excalidraw` file is a first-class document alongside Markdown — `lib/drawings.ts` decides which editor a file opens in (`documentKind`) and owns the on-disk format, while `components/DrawingCanvas.tsx` wraps `@excalidraw/excalidraw`. Things worth knowing before touching it:
  - `lib/drawings.ts` must stay free of any `@excalidraw/excalidraw` import. The bundle is ~1MB gzipped and is code-split behind a `lazy()`'d `<DrawingCanvas>`; importing it from a lib the workspace always loads would drag it into the main chunk.
  - Autosave serializes with `serializeAsJSON(..., 'local')` but then keeps only `PERSISTED_APP_STATE_KEYS`. The full local appState includes the viewport and selection, so panning the canvas alone would rewrite the file, wake the folder watcher, and dirty git. The baseline for "did anything change" is seeded from Excalidraw's first `onChange` (fired on mount), so *opening* a drawing never rewrites it.
  - Excalidraw fetches fonts lazily from a CDN unless `window.EXCALIDRAW_ASSET_PATH` is set. `src/main.tsx` points it at `/excalidraw-assets/`, which the `excalidrawAssets` plugin in `vite.config.ts` serves from the package in dev and copies into `dist/` on build. The CJK font (Xiaolai, ~12MB of the ~13MB total) is deliberately excluded and still falls back to the CDN.
  - **Custom shapes (DB / Gateway / CPU)** live in `lib/drawingLibrary.ts` and reach the canvas through Excalidraw's own library panel, built from element skeletons via `convertToExcalidrawElements`. That module imports Excalidraw at runtime, so like the canvas itself it must only ever be imported from `<DrawingCanvas>` — importing it from anywhere eagerly loaded would pull Excalidraw into the main chunk. Built-ins are rebuilt from source on every open and only the user's own items are persisted (Tauri store, `drawingLibrary` key), so deleting a built-in lasts the session and editing a stencil means editing the code.
  - Excalidraw's own open/save/export-to-disk actions are turned off: the file *is* the scene and is autosaved, and those actions route through `browser-fs-access`, which has no working save path in the Tauri webview. The drawing pane's own SVG/PNG buttons replace them.
- **Embedding a drawing in Markdown**: the drawing pane exports `<name>.svg` / `<name>.png` next to the `.excalidraw` source and copies an `![](…)` snippet to the clipboard. `components/MarkdownImage.tsx` is what makes that render — the webview can't load a bare filesystem path, so relative image sources are resolved against the open file's folder, read through the fs plugin (binary `readFile`, hence `fs:allow-read-file` in the capabilities), and handed to the `<img>` as a blob URL.
- Jira: `lib/jira.ts` (frontend types + `invoke()` calls + credential storage) pairs with `src-tauri/src/jira.rs` (the actual HTTP calls). `components/JiraSidebarSection.tsx` and `JiraTicketDetail.tsx` are the UI. A project's linked epic (`ProjectConfig.jiraEpicKey`) scopes which issues are fetched.
