(function () {
  "use strict";
  var KEY = "arzu.theme";
  var current = "light";
  try {
    var saved = window.localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") current = saved;
  } catch (_) {
    /* The theme remains usable without persistence. */
  }
  function apply(theme, persist) {
    if (theme !== "dark" && theme !== "light")
      throw new Error("Неизвестная тема оформления.");
    current = theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    if (persist) {
      try {
        window.localStorage.setItem(KEY, theme);
      } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent("arzu:theme", { detail: theme }));
    return theme;
  }
  window.ARZUTheme = {
    get: function () {
      return current;
    },
    set: function (theme) {
      return apply(theme, true);
    },
    toggle: function () {
      return apply(current === "light" ? "dark" : "light", true);
    },
  };
  window.addEventListener("storage", function (event) {
    if (event.key === KEY)
      apply(event.newValue === "dark" ? "dark" : "light", false);
  });
  apply(current, false);
})();
