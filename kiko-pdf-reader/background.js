const MENU_ID = "kiko-open-pdf-translator";

function openViewer() {
  return chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Open Kiko PDF Translator",
      contexts: ["page"]
    });
  });
});

chrome.action.onClicked.addListener(openViewer);

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID) openViewer();
});
