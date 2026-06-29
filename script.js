const STORAGE_KEY = "dual-notepad.v1";

const leftNote = document.querySelector("#leftNote");
const rightNote = document.querySelector("#rightNote");
const syncScroll = document.querySelector("#syncScroll");
const syncLabel = document.querySelector("#syncLabel");
const shareButton = document.querySelector("#shareButton");
const shareStatus = document.querySelector("#shareStatus");

const defaultState = {
  left: "",
  right: "",
  sync: true
};

let isSyncingScroll = false;
let statusTimer;

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return defaultState;
  }
}

function saveState() {
  const state = {
    left: leftNote.value,
    right: rightNote.value,
    sync: syncScroll.checked
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentState() {
  return {
    left: leftNote.value,
    right: rightNote.value,
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

function applyState(state) {
  leftNote.value = typeof state.left === "string" ? state.left : "";
  rightNote.value = typeof state.right === "string" ? state.right : "";
  syncScroll.checked = state.sync !== false;
  updateSyncLabel();
  saveState();
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
    applyState(decodeShareData(sharedValue));
    showStatus("共有リンクの内容を読み込みました");
    return true;
  } catch {
    showStatus("共有リンクを読み込めませんでした");
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

if (!restoreSharedState()) {
  restoreState();
}

leftNote.addEventListener("input", saveState);
rightNote.addEventListener("input", saveState);
syncScroll.addEventListener("change", () => {
  updateSyncLabel();
  saveState();
});
shareButton.addEventListener("click", copyShareLink);
window.addEventListener("hashchange", restoreSharedState);

leftNote.addEventListener("scroll", () => applyLinkedScroll(leftNote, rightNote));
rightNote.addEventListener("scroll", () => applyLinkedScroll(rightNote, leftNote));
