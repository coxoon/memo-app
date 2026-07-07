const STORAGE_KEY = "dual-notepad.v2";

const leftNote = document.querySelector("#leftNote");
const rightNote = document.querySelector("#rightNote");
const syncScroll = document.querySelector("#syncScroll");
const syncLabel = document.querySelector("#syncLabel");
const shareButton = document.querySelector("#shareButton");
const shareStatus = document.querySelector("#shareStatus");
const colorButtons = document.querySelectorAll(".color-button");
const editors = [leftNote, rightNote];

const defaultState = {
  left: "",
  right: "",
  sync: true
};

let isSyncingScroll = false;
let statusTimer;
let activeEditor = leftNote;

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return defaultState;
  }
}

function saveState() {
  const state = {
    left: leftNote.innerHTML,
    right: rightNote.innerHTML,
    sync: syncScroll.checked
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentState() {
  return {
    left: leftNote.innerHTML,
    right: rightNote.innerHTML,
    sync: syncScroll.checked
  };
}

function updateSyncLabel() {
  syncLabel.textContent = syncScroll.checked ? "スクロール連動" : "非連動";
}

function showStatus(message) {
  shareStatus.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    shareStatus.textContent = "";
  }, 3500);
}

function encodeShareData(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeShareData(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return JSON.parse(new TextDecoder().decode(bytes));
}

function looksLikeHtml(value) {
  return /<[a-z][\s\S]*>/i.test(value);
}

function cleanHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = value;
  const allowedColors = new Map([
    ["#1d2430", "#1d2430"],
    ["rgb(29, 36, 48)", "#1d2430"],
    ["#d23f31", "#d23f31"],
    ["rgb(210, 63, 49)", "#d23f31"],
    ["#2368c4", "#2368c4"],
    ["rgb(35, 104, 196)", "#2368c4"],
    ["#248052", "#248052"],
    ["rgb(36, 128, 82)", "#248052"],
    ["#b7791f", "#b7791f"],
    ["rgb(183, 121, 31)", "#b7791f"],
    ["#7c4dbe", "#7c4dbe"],
    ["rgb(124, 77, 190)", "#7c4dbe"]
  ]);

  template.content.querySelectorAll("*").forEach((element) => {
    if (element.tagName === "FONT") {
      const span = document.createElement("span");
      const color = allowedColors.get((element.getAttribute("color") || element.style.color).toLowerCase());

      if (color) {
        span.style.color = color;
      }

      span.append(...element.childNodes);
      element.replaceWith(span);
      return;
    }

    if (element.tagName !== "SPAN" && element.tagName !== "DIV" && element.tagName !== "BR") {
      element.replaceWith(...element.childNodes);
      return;
    }

    [...element.attributes].forEach((attribute) => {
      if (attribute.name !== "style") {
        element.removeAttribute(attribute.name);
      }
    });

    const color = allowedColors.get(element.style.color.toLowerCase());
    element.removeAttribute("style");

    if (color) {
      element.style.color = color;
    }
  });

  return template.innerHTML;
}

function setEditorContent(editor, value) {
  const content = typeof value === "string" ? value : "";

  if (looksLikeHtml(content)) {
    editor.innerHTML = cleanHtml(content);
    return;
  }

  editor.textContent = content;
}

function applyState(state, options = {}) {
  const shouldSave = options.save !== false;

  setEditorContent(leftNote, state.left);
  setEditorContent(rightNote, state.right);
  syncScroll.checked = state.sync !== false;
  updateSyncLabel();

  if (shouldSave) {
    saveState();
  }
}

function shareUrl() {
  const url = new URL(window.location.href);
  url.hash = `share=${encodeShareData(currentState())}`;
  return url.toString();
}

async function copyShareLink() {
  const url = shareUrl();

  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, url });
      showStatus("共有リンクを開きました");
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    showStatus("共有リンクをコピーしました");
  } catch {
    window.prompt("共有リンクをコピーしてください", url);
    showStatus("共有リンクを表示しました");
  }
}

function restoreSharedState() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const sharedValue = params.get("share");

  if (!sharedValue) {
    return false;
  }

  try {
    applyState(decodeShareData(sharedValue), { save: false });
    showStatus("共有リンクの内容を読み込みました");
    return true;
  } catch {
    showStatus("共有リンクを読み込めませんでした");
    return false;
  }
}

async function restoreDocumentState() {
  const params = new URLSearchParams(window.location.search);
  const documentName = params.get("doc");

  if (!documentName) {
    return false;
  }

  if (!/^[a-z0-9-]+$/i.test(documentName)) {
    showStatus("共有データ名が正しくありません");
    return false;
  }

  try {
    const response = await fetch(`shared/${documentName}.json`, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Document not found");
    }

    applyState(await response.json(), { save: false });
    showStatus("共有データを読み込みました");
    return true;
  } catch {
    showStatus("共有データを読み込めませんでした");
    return false;
  }
}

function scrollRatio(source) {
  const maxScroll = source.scrollHeight - source.clientHeight;
  return maxScroll <= 0 ? 0 : source.scrollTop / maxScroll;
}

function applyLinkedScroll(source, target) {
  if (!syncScroll.checked || isSyncingScroll) {
    return;
  }

  const targetMaxScroll = target.scrollHeight - target.clientHeight;
  isSyncingScroll = true;
  target.scrollTop = scrollRatio(source) * Math.max(0, targetMaxScroll);
  requestAnimationFrame(() => {
    isSyncingScroll = false;
  });
}

function restoreState() {
  const state = loadState();
  applyState(state);
}

function applyTextColor(color) {
  activeEditor.focus();
  document.execCommand("foreColor", false, color);
  saveState();
}

async function initialize() {
  if (restoreSharedState()) {
    return;
  }

  if (await restoreDocumentState()) {
    return;
  }

  restoreState();
}

initialize();

editors.forEach((editor) => {
  editor.addEventListener("focus", () => {
    activeEditor = editor;
  });
  editor.addEventListener("input", saveState);
});
syncScroll.addEventListener("change", () => {
  updateSyncLabel();
  saveState();
});
shareButton.addEventListener("click", copyShareLink);
window.addEventListener("hashchange", restoreSharedState);

colorButtons.forEach((button) => {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  button.addEventListener("click", () => applyTextColor(button.dataset.color));
});

leftNote.addEventListener("scroll", () => applyLinkedScroll(leftNote, rightNote));
rightNote.addEventListener("scroll", () => applyLinkedScroll(rightNote, leftNote));
