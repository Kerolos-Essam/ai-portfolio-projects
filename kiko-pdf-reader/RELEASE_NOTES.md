# Kiko PDF Translator 3.0.3

## 3.0.3 reliable history shortcuts

- Keeps annotation undo and redo working after using pen size, color, page-number, and other non-text controls.
- Releases stale toolbar focus as soon as drawing begins.
- Still preserves normal text undo while actively typing in search fields, notes, or editable text.

## 3.0.2 cleaner reading controls

## 3.0.2 cleaner reading controls

- Restores reliable `Ctrl+Z` undo and `Ctrl+Shift+Z` redo as direct keyboard actions.
- Removes the visible Undo and Redo buttons to keep the annotation toolbar compact.
- Turns **This page teaches** into a thin, collapsed concept bar that expands on demand.
- Keeps the concept count and current section available without covering the PDF while collapsed.

## 3.0.1 page stability fix

## 3.0.1 page stability fix

- Locks the active page number while zooming, fitting, or rotating.
- Prevents temporary resize layouts from being mistaken for user scrolling.
- Uses instant internal anchor restoration while keeping explicit page navigation smooth.
- Calculates the current page from the final viewport geometry instead of stale intersection ratios.
- Resumes normal page tracking immediately after the layout settles.

## Highlights

- Stable anchored zoom with smaller steps and adaptive rendering memory.
- English pronunciation for selected text, saved vocabulary, and review cards.
- Explicit `Ctrl+Z` undo and `Ctrl+Shift+Z` redo with an in-app shortcut guide.
- Auto, C++, and General English contextual explanation modes.
- Editable globally deduplicated vocabulary with CSV export and JSON backup/import.
- Spaced vocabulary review using Again, Good, and Easy scheduling.
- Exact-occurrence PDF search with cross-span phrase highlighting.
- Drag-and-drop opening, polished responsive UI, application icons, and PDF-handler settings.

## Reliability

- Cancels stale PDF renders and loading tasks.
- Releases previously opened PDF documents and cleans old page canvases.
- Preserves horizontal and vertical reading position while zooming.
- Prevents old background page measurements from changing a newly opened document.
- Falls back to normal translation if the contextual language model fails.
- Reports local vocabulary and annotation storage failures.
- Flushes pending annotation saves when the reader closes.
- Exports both current `pen` strokes and annotations saved by older builds.
- Adds accessible names and live status announcements to icon controls.
