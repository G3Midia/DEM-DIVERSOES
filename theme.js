(function () {
  var STORAGE_KEY = "dm-theme";
  var root = document.documentElement;
  var mediaQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  function getStoredTheme() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch (error) {
      return null;
    }
  }

  function getEffectiveTheme() {
    var forcedTheme = root.getAttribute("data-theme");
    if (forcedTheme === "light" || forcedTheme === "dark") {
      return forcedTheme;
    }
    if (mediaQuery && mediaQuery.matches) {
      return "dark";
    }
    return "light";
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function updateToggleButtons() {
    var effectiveTheme = getEffectiveTheme();
    var nextThemeLabel =
      effectiveTheme === "dark" ? "Tema: claro" : "Tema: escuro";
    var ariaLabel =
      effectiveTheme === "dark"
        ? "Ativar tema claro"
        : "Ativar tema escuro";

    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.textContent = nextThemeLabel;
      button.setAttribute("aria-label", ariaLabel);
      button.setAttribute("data-current-theme", effectiveTheme);
    });
  }

  function closeMobileNav(toggleButton) {
    var navMenu = toggleButton.closest(".nav-menu, .admin-nav-menu");
    var navToggle = document.querySelector(".nav-toggle, .admin-nav-toggle");
    if (!navMenu || !navMenu.classList.contains("is-open")) return;
    navMenu.classList.remove("is-open");
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", "false");
    }
  }

  function toggleTheme(toggleButton) {
    var currentTheme = getEffectiveTheme();
    var nextTheme = currentTheme === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", nextTheme);
    setStoredTheme(nextTheme);
    updateToggleButtons();
    if (toggleButton) {
      closeMobileNav(toggleButton);
    }
  }

  function bindThemeToggles() {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      if (button.dataset.themeBound === "1") return;
      button.dataset.themeBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        toggleTheme(button);
      });
    });
  }

  function refreshFromSystem() {
    if (getStoredTheme()) return;
    updateToggleButtons();
  }

  function initTheme() {
    bindThemeToggles();
    updateToggleButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }

  if (mediaQuery) {
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", refreshFromSystem);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(refreshFromSystem);
    }
  }
})();
