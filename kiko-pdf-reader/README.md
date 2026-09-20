# Kiko PDF Translator 3

Open a PDF, hover over an English word or select a sentence, and see its Arabic translation directly over the page. Translation uses Chrome's built-in, on-device Translator AI.

## PDF workspace features

- Page thumbnails and page navigation
- Continuous, natural scrolling through the complete document; Page Up and Page Down scroll by one viewport instead of replacing the page
- Exact-occurrence search across the document, including phrases split across PDF text spans
- Stable anchored zoom, fit-width, fit-page, and rotation without losing the reading position
- Pen and translucent highlighter with configurable color and size
- Text annotations, including Arabic text
- Eraser, keyboard undo (`Ctrl+Z`), keyboard redo (`Ctrl+Shift+Z`), and hide/show annotations
- Automatic local annotation persistence for each PDF
- Print and download with annotations baked into the exported PDF
- Explicit vocabulary saving: select text, translate it, then press `+ ADD` (nothing is saved automatically)
- Individual save buttons for the important technical terms detected in a selected passage
- English pronunciation for selected and saved words
- Auto, C++, and General English explanation modes
- A thin, collapsible **This page teaches** bar for the current Primer concepts
- Large searchable saved-words drawer with Arabic meanings, useful context, editing, deletion, and CSV export
- Spaced vocabulary review with Again, Good, and Easy scheduling
- Portable JSON backup and import for moving vocabulary between computers
- Drag-and-drop PDF opening and a settings page for choosing the default PDF viewer
- Keyboard shortcuts: `Ctrl+F`, `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+Y`, `Ctrl+S`, and `Ctrl+P`

## Install

1. Keep this folder on your computer.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this `kiko-pdf-translator` folder.

To update an existing installation, replace the files inside the same folder and click **Reload** on `chrome://extensions`. Do not remove the extension first unless you have backed up your vocabulary, because removing it clears its local Chrome storage.

## Use

1. Open any PDF normally in Chrome. Chrome 151+ routes it directly into Kiko PDF Translator while keeping its original URL.
2. Hover over an English word or select a sentence.
3. The Arabic translation appears in a 50%-transparent tooltip over the PDF.
4. For selected text, press the small **+ ADD** button to save it. You can also press **+** beside an extracted technical term.
5. Press **🔊** to hear the English pronunciation.
6. Open **Saved words** in the lower toolbar to search, edit, review, delete, back up, import, or export your vocabulary.
7. Choose **Auto**, **C++**, or **General English** from the Mode menu when you want to control the explanation style.

You can still click the extension icon and choose a PDF manually. When a PDF was opened automatically, click **Chrome viewer** in the toolbar to fall back to Chrome's native reader.

After a file is selected, the file-picker welcome screen is removed. The viewer virtualizes long documents, keeping only nearby pages rendered so very large books remain responsive.

The first use may require clicking **Enable AI** to download Chrome's translation and language models. The assistant uses the surrounding paragraph and explains the intended meaning instead of translating word-for-word. If the larger contextual model is unavailable, direct Arabic translation and the built-in C++ glossary continue working.

PDFs, annotations, selected text, and vocabulary are not uploaded to a developer-operated server. See `PRIVACY.md` for the complete summary.

## Requirements

- Google Chrome 151 or newer on desktop for automatic PDF handling.
- A text-based PDF. Scanned image PDFs require OCR and are not supported in version 3.0.
