import {
  PDFDocument,
  LineCapStyle,
  StandardFonts,
  rgb
} from "./vendor/pdf-lib.esm.min.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

export function createPdfWorkspace(api) {
  const viewer = document.querySelector("#viewer");
  const composer = document.querySelector("#textComposer");
  const annotationText = document.querySelector("#annotationText");
  const colorInput = document.querySelector("#annotationColor");
  const sizeInput = document.querySelector("#annotationSize");
  const visibilityButton = document.querySelector("#toggleAnnotations");
  const saveStatus = document.querySelector("#saveStatus");
  const sidebar = document.querySelector("#sidebar");
  const thumbnailList = document.querySelector("#thumbnailList");
  const searchInput = document.querySelector("#searchInput");
  const searchCount = document.querySelector("#searchCount");
  const downloadButton = document.querySelector("#downloadPdf");
  const printButton = document.querySelector("#printPdf");

  let tool = "select";
  let annotations = new Map();
  let undoStack = [];
  let redoStack = [];
  let annotationsVisible = true;
  const pageViews = new Map();
  const svgByPage = new Map();
  let currentPageNumber = 1;
  let storageKey = "";
  let saveTimer = null;
  let pendingSave = null;
  let drawing = null;
  let textPoint = null;
  let searchQuery = "";
  let searchResults = [];
  let searchIndex = -1;
  let searchToken = 0;
  let thumbnailObserver = null;
  let outputBusy = false;

  function pageAnnotations(pageNumber = currentPageNumber) {
    if (!annotations.has(pageNumber)) annotations.set(pageNumber, []);
    return annotations.get(pageNumber);
  }

  function serialize() {
    return Object.fromEntries([...annotations.entries()].map(([page, items]) => [page, items]));
  }

  function snapshot() {
    return JSON.stringify(serialize());
  }

  function restore(serialized) {
    const parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    annotations = new Map(Object.entries(parsed || {}).map(([page, items]) => [Number(page), items]));
    renderAllAnnotations();
    scheduleSave();
  }

  function mutate(change, affectedPage = null) {
    undoStack.push(snapshot());
    if (undoStack.length > 60) undoStack.shift();
    redoStack = [];
    change();
    if (affectedPage) renderAnnotations(affectedPage);
    else renderAllAnnotations();
    scheduleSave();
  }

  function undoAnnotation() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
  }

  function redoAnnotation() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
  }

  async function commitPendingSave() {
    const pending = pendingSave;
    if (!pending) return;
    pendingSave = null;
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      await chrome.storage.local.set({ [pending.key]: pending.value });
      if (storageKey === pending.key) saveStatus.textContent = "Saved locally";
    } catch (error) {
      if (storageKey === pending.key) saveStatus.textContent = "Save failed";
      api.showToast(`Could not save annotations: ${error.message}`);
    }
  }

  function scheduleSave() {
    if (!storageKey) return;
    saveStatus.textContent = "Saving…";
    clearTimeout(saveTimer);
    pendingSave = { key: storageKey, value: serialize() };
    saveTimer = setTimeout(commitPendingSave, 250);
  }

  function setTool(nextTool) {
    tool = nextTool;
    for (const button of document.querySelectorAll("[data-tool]")) {
      button.classList.toggle("active", button.dataset.tool === tool);
    }
    for (const { pageElement } of pageViews.values()) {
      pageElement.classList.toggle("annotating", tool !== "select");
    }
    composer.hidden = true;
    for (const svg of svgByPage.values()) {
      svg.style.cursor = tool === "eraser" ? "not-allowed" : "crosshair";
    }
  }

  function localPoint(event, svg, viewport) {
    const rect = svg.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (viewport.width / rect.width),
      y: (event.clientY - rect.top) * (viewport.height / rect.height)
    };
  }

  function toPdfPoint(local, viewport) {
    const [x, y] = viewport.convertToPdfPoint(local.x, local.y);
    return { x, y };
  }

  function toViewportPoint(point, viewport) {
    const [x, y] = viewport.convertToViewportPoint(point.x, point.y);
    return { x, y };
  }

  function pathData(points, viewport) {
    return points.map((point, index) => {
      const shown = toViewportPoint(point, viewport);
      return `${index ? "L" : "M"}${shown.x.toFixed(2)},${shown.y.toFixed(2)}`;
    }).join(" ");
  }

  function makeStroke(annotation, viewport) {
    const path = document.createElementNS(SVG_NS, "path");
    path.classList.add("annotation-stroke");
    path.dataset.annotationId = annotation.id;
    path.setAttribute("d", pathData(annotation.points, viewport));
    path.setAttribute("stroke", annotation.color);
    path.setAttribute("stroke-width", String(Math.max(1, annotation.width * viewport.scale)));
    if (annotation.type === "highlight") {
      path.setAttribute("opacity", "0.34");
      path.style.mixBlendMode = "multiply";
    }
    return path;
  }

  function makeText(annotation, viewport) {
    const shown = toViewportPoint(annotation, viewport);
    const size = annotation.fontSize * viewport.scale;
    const text = document.createElementNS(SVG_NS, "text");
    text.classList.add("annotation-text");
    text.dataset.annotationId = annotation.id;
    text.setAttribute("x", String(shown.x));
    text.setAttribute("y", String(shown.y + size));
    text.setAttribute("fill", annotation.color);
    text.setAttribute("font-size", String(size));
    if (/\p{Script=Arabic}/u.test(annotation.text)) {
      text.setAttribute("direction", "rtl");
      text.setAttribute("text-anchor", "end");
    }
    annotation.text.split("\n").forEach((line, index) => {
      const tspan = document.createElementNS(SVG_NS, "tspan");
      tspan.setAttribute("x", String(shown.x));
      tspan.setAttribute("dy", index ? String(size * 1.25) : "0");
      tspan.textContent = line;
      text.append(tspan);
    });
    return text;
  }

  function renderAnnotations(pageNumber) {
    const view = pageViews.get(pageNumber);
    if (!view?.pageElement?.isConnected) return;
    const { pageElement, viewport } = view;
    svgByPage.get(pageNumber)?.remove();
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.classList.add("annotation-layer");
    svg.setAttribute("viewBox", `0 0 ${viewport.width} ${viewport.height}`);
    svg.hidden = !annotationsVisible;
    for (const annotation of pageAnnotations(pageNumber)) {
      svg.append(annotation.type === "text" ? makeText(annotation, viewport) : makeStroke(annotation, viewport));
    }
    pageElement.append(svg);
    svgByPage.set(pageNumber, svg);
    attachAnnotationEvents(svg, pageNumber, viewport);
    setTool(tool);
  }

  function renderAllAnnotations() {
    for (const pageNumber of pageViews.keys()) renderAnnotations(pageNumber);
  }

  function eraseTarget(target, pageNumber) {
    const id = target?.closest?.("[data-annotation-id]")?.dataset.annotationId;
    if (!id) return;
    const items = pageAnnotations(pageNumber);
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0) mutate(() => items.splice(index, 1), pageNumber);
  }

  function attachAnnotationEvents(svg, pageNumber, viewport) {
    svg.addEventListener("pointerdown", (event) => {
      if (tool === "select") return;
      event.preventDefault();
      if (document.activeElement instanceof HTMLElement &&
          document.activeElement.matches("input, textarea, [contenteditable='true']")) {
        document.activeElement.blur();
      }
      if (tool === "eraser") {
        eraseTarget(event.target, pageNumber);
        return;
      }

      const local = localPoint(event, svg, viewport);
      if (tool === "text") {
        textPoint = { ...toPdfPoint(local, viewport), pageNumber };
        composer.style.left = `${Math.min(event.clientX + 8, innerWidth - 250)}px`;
        composer.style.top = `${Math.min(event.clientY + 8, innerHeight - 150)}px`;
        composer.hidden = false;
        annotationText.value = "";
        annotationText.focus();
        return;
      }

      drawing = {
        id: crypto.randomUUID(),
        type: tool,
        color: colorInput.value,
        width: Number(sizeInput.value) * (tool === "highlight" ? 4 : 1) / viewport.scale,
        points: [toPdfPoint(local, viewport)]
      };
      drawing.pageNumber = pageNumber;
      const draft = makeStroke(drawing, viewport);
      draft.dataset.draft = "true";
      svg.append(draft);
      svg.setPointerCapture(event.pointerId);
    });

    svg.addEventListener("pointermove", (event) => {
      if (tool === "eraser" && event.buttons) {
        eraseTarget(event.target, pageNumber);
        return;
      }
      if (!drawing) return;
      const next = toPdfPoint(localPoint(event, svg, viewport), viewport);
      const previous = drawing.points.at(-1);
      if (Math.hypot(next.x - previous.x, next.y - previous.y) < .7) return;
      drawing.points.push(next);
      svg.querySelector('[data-draft="true"]')?.setAttribute("d", pathData(drawing.points, viewport));
    });

    const finishDrawing = () => {
      if (!drawing) return;
      const finished = drawing;
      drawing = null;
      if (finished.points.length === 1) {
        finished.points.push({ x: finished.points[0].x + .01, y: finished.points[0].y + .01 });
      }
      mutate(() => pageAnnotations(finished.pageNumber).push(finished), finished.pageNumber);
    };
    svg.addEventListener("pointerup", finishDrawing);
    svg.addEventListener("pointercancel", finishDrawing);
  }

  function updateThumbnailSelection() {
    for (const button of thumbnailList.querySelectorAll(".thumbnail-button")) {
      button.classList.toggle("current", Number(button.dataset.page) === currentPageNumber);
    }
    thumbnailList.querySelector(".thumbnail-button.current")?.scrollIntoView({ block: "nearest" });
  }

  function occurrenceIndexes(text, query) {
    const indexes = [];
    let from = 0;
    while (query && from <= text.length - query.length) {
      const index = text.indexOf(query, from);
      if (index < 0) break;
      indexes.push(index);
      from = index + Math.max(1, query.length);
    }
    return indexes;
  }

  function highlightSearchOnPage(pageElement) {
    const textLayer = pageElement.querySelector(".textLayer:not(.staging)");
    if (!textLayer) return;
    const spans = [...textLayer.querySelectorAll("span")].filter((span) => span.textContent && !span.querySelector("span"));
    for (const span of spans) span.classList.remove("search-hit", "search-hit-current");
    if (!searchQuery) return;

    let combined = "";
    const segments = spans.map((span, index) => {
      if (index) combined += " ";
      const start = combined.length;
      combined += span.textContent;
      return { span, start, end: combined.length };
    });
    const hits = occurrenceIndexes(combined.toLowerCase(), searchQuery);
    const page = Number(pageElement.dataset.page);
    const current = searchResults[searchIndex];
    hits.forEach((start, occurrence) => {
      const end = start + searchQuery.length;
      for (const segment of segments) {
        if (segment.end <= start || segment.start >= end) continue;
        segment.span.classList.add("search-hit");
        if (current?.page === page && current.occurrence === occurrence) {
          segment.span.classList.add("search-hit-current");
        }
      }
    });
  }

  function focusCurrentSearchResult() {
    const result = searchResults[searchIndex];
    if (!result) return;
    const view = pageViews.get(result.page);
    if (!view) return;
    highlightSearchOnPage(view.pageElement);
    view.pageElement.querySelector(".search-hit-current")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function navigateToSearchResult() {
    const result = searchResults[searchIndex];
    if (!result) return;
    if (result.page !== api.getCurrentPage()) await api.navigateToPage(result.page);
    focusCurrentSearchResult();
  }

  function normalizeSearchText(value) {
    return value.replace(/\s+/g, " ").trim().toLowerCase();
  }

  function updateSearchCount() {
    searchCount.textContent = searchResults.length ? `${searchIndex + 1}/${searchResults.length}` : "0 found";
  }

  async function searchPdf() {
    const query = normalizeSearchText(searchInput.value);
    searchQuery = query;
    searchResults = [];
    searchIndex = -1;
    const token = ++searchToken;
    highlightSearch();
    if (!query || !api.getPdfDocument()) {
      searchCount.textContent = "";
      return;
    }

    const pdf = api.getPdfDocument();
    searchCount.textContent = "Searching…";
    try {
      for (let start = 1; start <= pdf.numPages; start += 8) {
        const pages = [];
        for (let page = start; page < start + 8 && page <= pdf.numPages; page += 1) {
          pages.push(pdf.getPage(page).then(async (pdfPage) => ({
            page,
            text: normalizeSearchText((await pdfPage.getTextContent()).items.map((item) => item.str).join(" "))
          })));
        }
        const batch = await Promise.all(pages);
        if (token !== searchToken || pdf !== api.getPdfDocument()) return;
        for (const result of batch) {
          const hits = occurrenceIndexes(result.text, query);
          hits.forEach((_, occurrence) => searchResults.push({ page: result.page, occurrence }));
        }
        searchCount.textContent = `${searchResults.length} found…`;
      }

      if (searchResults.length) {
        const currentMatch = searchResults.findIndex((result) => result.page >= api.getCurrentPage());
        searchIndex = currentMatch >= 0 ? currentMatch : 0;
        await navigateToSearchResult();
        updateSearchCount();
      } else {
        searchCount.textContent = "0 found";
      }
    } catch (error) {
      if (token !== searchToken) return;
      searchCount.textContent = "Search failed";
      api.showToast(error.message || "Could not search this PDF");
    }
  }

  async function moveSearch(direction) {
    if (!searchResults.length || normalizeSearchText(searchInput.value) !== searchQuery) {
      await searchPdf();
      return;
    }
    searchIndex = (searchIndex + direction + searchResults.length) % searchResults.length;
    await navigateToSearchResult();
    updateSearchCount();
  }

  function highlightSearch() {
    for (const { pageElement } of pageViews.values()) highlightSearchOnPage(pageElement);
  }

  async function renderThumbnail(button) {
    if (button.dataset.rendered || !api.getPdfDocument()) return;
    button.dataset.rendered = "true";
    const canvas = button.querySelector("canvas");
    try {
      const documentAtStart = api.getPdfDocument();
      const page = await documentAtStart.getPage(Number(button.dataset.page));
      if (documentAtStart !== api.getPdfDocument() || !button.isConnected) return;
      const base = page.getViewport({ scale: 1, rotation: (page.rotate + api.getRotation()) % 360 });
      const scale = 132 / base.width;
      const viewport = page.getViewport({ scale, rotation: (page.rotate + api.getRotation()) % 360 });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    } catch {
      delete button.dataset.rendered;
    }
  }

  function buildThumbnails() {
    thumbnailObserver?.disconnect();
    thumbnailList.replaceChildren();
    const pdf = api.getPdfDocument();
    if (!pdf) return;

    const fragment = document.createDocumentFragment();
    for (let page = 1; page <= pdf.numPages; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumbnail-button";
      button.dataset.page = String(page);
      const canvas = document.createElement("canvas");
      const label = document.createElement("span");
      label.textContent = String(page);
      button.append(canvas, label);
      button.addEventListener("click", () => api.navigateToPage(page));
      fragment.append(button);
    }
    thumbnailList.append(fragment);

    thumbnailObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) renderThumbnail(entry.target);
    }, { root: thumbnailList, rootMargin: "240px" });
    for (const button of thumbnailList.querySelectorAll(".thumbnail-button")) thumbnailObserver.observe(button);
    updateThumbnailSelection();
  }

  function colorFromHex(hex) {
    const value = hex.replace("#", "");
    return rgb(
      parseInt(value.slice(0, 2), 16) / 255,
      parseInt(value.slice(2, 4), 16) / 255,
      parseInt(value.slice(4, 6), 16) / 255
    );
  }

  async function rasterizeText(pdfDoc, annotation) {
    const scale = 3;
    const lines = annotation.text.split("\n");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = `${annotation.fontSize * scale}px Tahoma, Arial, sans-serif`;
    const width = Math.max(...lines.map((line) => context.measureText(line).width), 1) + 10 * scale;
    const lineHeight = annotation.fontSize * 1.3 * scale;
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(lineHeight * lines.length + 4 * scale);
    context.font = `${annotation.fontSize * scale}px Tahoma, Arial, sans-serif`;
    context.fillStyle = annotation.color;
    context.textBaseline = "top";
    const rtl = /\p{Script=Arabic}/u.test(annotation.text);
    context.direction = rtl ? "rtl" : "ltr";
    context.textAlign = rtl ? "right" : "left";
    lines.forEach((line, index) => context.fillText(line, rtl ? canvas.width - 5 * scale : 5 * scale, index * lineHeight));
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return {
      image: await pdfDoc.embedPng(await blob.arrayBuffer()),
      width: canvas.width / scale,
      height: canvas.height / scale,
      rtl
    };
  }

  async function createAnnotatedPdf() {
    const original = api.getOriginalBytes();
    if (!original) throw new Error("No PDF is open.");
    const pdfDoc = await PDFDocument.load(original.slice(0));
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const [pageNumber, items] of annotations.entries()) {
      const page = pages[pageNumber - 1];
      if (!page) continue;
      for (const annotation of items) {
        if (annotation.type === "pen" || annotation.type === "ink" || annotation.type === "highlight") {
          for (let index = 1; index < annotation.points.length; index += 1) {
            page.drawLine({
              start: annotation.points[index - 1],
              end: annotation.points[index],
              thickness: annotation.width,
              color: colorFromHex(annotation.color),
              opacity: annotation.type === "highlight" ? .34 : 1,
              lineCap: LineCapStyle.Round
            });
          }
          continue;
        }

        const asciiOnly = /^[\x00-\x7F]*$/.test(annotation.text);
        if (asciiOnly) {
          annotation.text.split("\n").forEach((line, index) => {
            page.drawText(line, {
              x: annotation.x,
              y: annotation.y - annotation.fontSize - index * annotation.fontSize * 1.25,
              size: annotation.fontSize,
              font,
              color: colorFromHex(annotation.color)
            });
          });
        } else {
          const raster = await rasterizeText(pdfDoc, annotation);
          page.drawImage(raster.image, {
            x: raster.rtl ? annotation.x - raster.width : annotation.x,
            y: annotation.y - raster.height,
            width: raster.width,
            height: raster.height
          });
        }
      }
    }
    return pdfDoc.save();
  }

  function downloadBytes(bytes, filename) {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function exportPdf() {
    if (outputBusy) return;
    outputBusy = true;
    downloadButton.disabled = true;
    printButton.disabled = true;
    saveStatus.textContent = "Building PDF…";
    try {
      const bytes = await createAnnotatedPdf();
      const name = api.getFileName().replace(/\.pdf$/i, "") || "document";
      downloadBytes(bytes, `${name}-annotated.pdf`);
      saveStatus.textContent = "Downloaded";
    } catch (error) {
      saveStatus.textContent = "Export failed";
      api.showToast(error.message);
    } finally {
      outputBusy = false;
      downloadButton.disabled = false;
      printButton.disabled = false;
    }
  }

  async function printPdf() {
    if (outputBusy) return;
    outputBusy = true;
    downloadButton.disabled = true;
    printButton.disabled = true;
    saveStatus.textContent = "Preparing print…";
    try {
      const bytes = await createAnnotatedPdf();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const frame = document.createElement("iframe");
      frame.style.position = "fixed";
      frame.style.width = "1px";
      frame.style.height = "1px";
      frame.style.opacity = "0";
      frame.src = url;
      frame.addEventListener("load", () => {
        frame.contentWindow.print();
        setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
      });
      document.body.append(frame);
      saveStatus.textContent = "Print ready";
    } catch (error) {
      saveStatus.textContent = "Print failed";
      api.showToast(error.message);
    } finally {
      outputBusy = false;
      downloadButton.disabled = false;
      printButton.disabled = false;
    }
  }

  async function onDocumentLoaded() {
    const pdf = api.getPdfDocument();
    storageKey = `kiko-pdf-annotations:${pdf?.fingerprints?.[0] || api.getFileName()}`;
    let stored = {};
    try {
      stored = await chrome.storage.local.get(storageKey);
    } catch (error) {
      api.showToast(`Could not load annotations: ${error.message}`);
    }
    annotations = new Map(Object.entries(stored[storageKey] || {}).map(([page, items]) => [Number(page), items]));
    currentPageNumber = 1;
    undoStack = [];
    redoStack = [];
    searchInput.value = "";
    searchQuery = "";
    searchResults = [];
    searchCount.textContent = "";
    pageViews.clear();
    svgByPage.clear();
    buildThumbnails();
    downloadButton.disabled = false;
    printButton.disabled = false;
  }

  function onPageRendered({ pageNumber, viewport, pageElement }) {
    pageViews.set(pageNumber, { viewport, pageElement });
    renderAnnotations(pageNumber);
    highlightSearchOnPage(pageElement);
  }

  function onPageUnloaded(pageNumber) {
    svgByPage.get(pageNumber)?.remove();
    svgByPage.delete(pageNumber);
    pageViews.delete(pageNumber);
  }

  function onCurrentPageChanged(pageNumber) {
    currentPageNumber = pageNumber;
    updateThumbnailSelection();
  }

  for (const button of document.querySelectorAll("[data-tool]")) {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  }
  visibilityButton.addEventListener("click", () => {
    annotationsVisible = !annotationsVisible;
    for (const svg of svgByPage.values()) svg.hidden = !annotationsVisible;
    visibilityButton.textContent = annotationsVisible ? "◉ Annotations" : "○ Annotations";
  });
  document.querySelector("#cancelText").addEventListener("click", () => { composer.hidden = true; });
  document.querySelector("#addText").addEventListener("click", () => {
    const text = annotationText.value.trim();
    if (!text || !textPoint) { composer.hidden = true; return; }
    const annotation = {
      id: crypto.randomUUID(),
      type: "text",
      x: textPoint.x,
      y: textPoint.y,
      text,
      color: colorInput.value,
      fontSize: Math.max(8, Number(sizeInput.value) * 3)
    };
    mutate(() => pageAnnotations(textPoint.pageNumber).push(annotation), textPoint.pageNumber);
    composer.hidden = true;
  });
  annotationText.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") document.querySelector("#addText").click();
    if (event.key === "Escape") composer.hidden = true;
  });
  document.querySelector("#toggleSidebar").addEventListener("click", () => {
    sidebar.hidden = !sidebar.hidden;
    document.body.classList.toggle("sidebar-open", !sidebar.hidden);
    if (!sidebar.hidden) updateThumbnailSelection();
  });
  document.querySelector("#searchNext").addEventListener("click", () => moveSearch(1));
  document.querySelector("#searchPrevious").addEventListener("click", () => moveSearch(-1));
  searchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") searchPdf(); });
  searchInput.addEventListener("input", () => {
    if (!searchInput.value) {
      searchToken += 1;
      searchQuery = "";
      searchResults = [];
      searchCount.textContent = "";
      highlightSearch();
    }
  });
  document.querySelector("#fitWidth").addEventListener("click", () => api.fit("width"));
  document.querySelector("#fitPage").addEventListener("click", () => api.fit("page"));
  document.querySelector("#rotatePage").addEventListener("click", async () => {
    await api.rotate();
    buildThumbnails();
  });
  downloadButton.addEventListener("click", exportPdf);
  printButton.addEventListener("click", printPdf);
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const textInputTypes = new Set(["", "email", "password", "search", "tel", "text", "url"]);
    const editingText = target instanceof HTMLElement && (
      target.isContentEditable ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement && textInputTypes.has(target.type))
    );
    if (!(event.ctrlKey || event.metaKey) || event.altKey || editingText) return;
    if (event.key.toLowerCase() === "z" || event.code === "KeyZ") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.shiftKey) redoAnnotation();
      else undoAnnotation();
    }
    if (event.key.toLowerCase() === "y" || event.code === "KeyY") {
      event.preventDefault();
      event.stopImmediatePropagation();
      redoAnnotation();
    }
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      exportPdf();
    }
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      printPdf();
    }
  }, { capture: true });
  window.addEventListener("pagehide", () => {
    if (pendingSave) void commitPendingSave();
  });

  return { onDocumentLoaded, onPageRendered, onPageUnloaded, onCurrentPageChanged, setTool };
}
