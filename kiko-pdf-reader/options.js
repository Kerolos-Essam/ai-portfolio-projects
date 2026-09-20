const handlePdfs = document.querySelector("#handlePdfs");
const status = document.querySelector("#status");

async function loadOptions() {
  if (!chrome.mimeHandler) {
    handlePdfs.disabled = true;
    status.textContent = "Automatic PDF handling requires Chrome 151 or newer.";
    return;
  }
  const options = await chrome.mimeHandler.getMimeHandlerOptions("application/pdf");
  handlePdfs.checked = options.enabled !== false;
}

handlePdfs.addEventListener("change", async () => {
  try {
    await chrome.mimeHandler.setMimeHandlerOptions("application/pdf", { enabled: handlePdfs.checked });
    status.textContent = handlePdfs.checked ? "Kiko PDF is now the default PDF reader." : "Chrome's original PDF viewer is now the default.";
  } catch (error) {
    status.textContent = `Could not change this setting: ${error.message}`;
  }
});

loadOptions().catch((error) => { status.textContent = error.message; });
