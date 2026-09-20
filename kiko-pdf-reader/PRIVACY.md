# Kiko PDF Privacy

Kiko PDF processes opened documents on the user's device. It does not upload PDFs, selected text, translations, annotations, or saved vocabulary to a developer-operated server.

Translation and contextual explanations use supported AI models built into Google Chrome. Saved vocabulary, settings, and annotations are stored locally through Chrome extension storage. Removing the extension removes this local data, so users should create a vocabulary backup before uninstalling.

The extension requests storage access for saved vocabulary, settings, and PDF annotations. It requests unlimited local storage so large annotated documents do not silently exceed Chrome's default extension-storage quota. It does not request browsing-history, website, account, microphone, camera, or location access.
