const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const source = fs.readFileSync("src/theme.js", "utf8");
function setup(initial, blocked = false) {
  const values = new Map(initial ? [["arzu.theme", initial]] : []),
    listeners = {},
    document = { documentElement: { dataset: {}, style: {} } },
    window = {
      localStorage: {
        getItem(k) {
          if (blocked) throw Error("blocked");
          return values.get(k) ?? null;
        },
        setItem(k, v) {
          if (blocked) throw Error("blocked");
          values.set(k, v);
        },
      },
      addEventListener(k, fn) {
        listeners[k] = fn;
      },
      dispatchEvent() {},
    };
  class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  const context = vm.createContext({ window, document, CustomEvent });
  vm.runInContext(source, context);
  return { theme: window.ARZUTheme, values, document, listeners };
}
test("theme toggle applies and persists both palettes without touching report or session state", () => {
  const { theme, values, document } = setup();
  assert.equal(theme.get(), "light");
  assert.equal(theme.toggle(), "dark");
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(document.documentElement.style.colorScheme, "dark");
  assert.equal(values.get("arzu.theme"), "dark");
  assert.equal(values.size, 1);
  assert.equal(theme.toggle(), "light");
});
test("stored theme is restored and invalid values fall back to light", () => {
  assert.equal(setup("dark").theme.get(), "dark");
  assert.equal(setup("invalid").theme.get(), "light");
});
test("theme remains usable when storage is unavailable; invalid setter leaves current theme intact", () => {
  const { theme } = setup(null, true);
  assert.equal(theme.toggle(), "dark");
  assert.throws(() => theme.set("unknown"), /Неизвестная тема/);
  assert.equal(theme.get(), "dark");
});
test("theme changes in another tab update the visible palette", () => {
  const { theme, listeners } = setup();
  listeners.storage({ key: "arzu.theme", newValue: "dark" });
  assert.equal(theme.get(), "dark");
  listeners.storage({ key: "arzu.theme", newValue: null });
  assert.equal(theme.get(), "light");
});
