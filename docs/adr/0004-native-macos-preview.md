# Native macOS preview

## Context

The native window needs the same PlantUML renderer, zoom controls, minimap and source view as the browser UI. Ebitengine does not expose a native window handle. Starting a local HTTP server for the embedded view would also expose GUI-only file APIs to other local browser clients and route native file operations through HTTP.

## Decision

Add `pumlv gui [paths...]` on macOS without starting an HTTP listener. Reuse the file registry and fsnotify watcher through a transport-independent server core. Keep HTTP and SSE for browser mode; use a custom `pumlv:` URL scheme for embedded assets and a WKWebView script-message bridge for file lists, source reads, selections and change events. Render the native file tree with guigui and share the same React `App`, preview and source components across both modes. Make the sidebar resizable from 200 points to half the window width, initially 288 points. Add WKWebView to the existing AppKit contentView using purego; dispatch AppKit work on the main queue. Locate the single application window by title. Other platforms retain the browser UI and report an error for `pumlv gui`.

## Consequences

The binary remains buildable with CGO_ENABLED=0. The native adapter is macOS-specific and assumes one pumlv window per process. File selection and source reads use the shared registry through the native bridge; fsnotify events update both the guigui tree and the React preview directly. Selection is retained until the React listener is ready and reconciled when files disappear. Popups spanning native and WebView content need separate design. The browser and native view share preview behavior, while file navigation uses guigui only in native mode.
