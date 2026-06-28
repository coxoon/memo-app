const STORAGE_KEY = "dual-notepad.v1";

const leftNote = document.querySelector("#leftNote");
const rightNote = document.querySelector("#rightNote");
const syncScroll = document.querySelector("#syncScroll");
const syncLabel = document.querySelector("#syncLabel");

const defaultState = {
  left: "",
  right: "",
  sync: true
};

let isSyncingScroll = false;

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

function updateSyncLabel() {
  syncLabel.textContent = syncScroll.checked ? "スクロール連動" : "非連動";
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
  leftNote.value = state.left;
  rightNote.value = state.right;
  syncScroll.checked = state.sync;
  updateSyncLabel();
}

restoreState();

leftNote.addEventListener("input", saveState);
rightNote.addEventListener("input", saveState);
syncScroll.addEventListener("change", () => {
  updateSyncLabel();
  saveState();
});

leftNote.addEventListener("scroll", () => applyLinkedScroll(leftNote, rightNote));
rightNote.addEventListener("scroll", () => applyLinkedScroll(rightNote, leftNote));
