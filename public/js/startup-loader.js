
/* Homepage-only Manlung Recovery loading screen */
(function () {
  const root = document.documentElement;

  root.classList.add("manlung-startup-loading");

  function finishLoader() {
    if (root.classList.contains("manlung-startup-complete")) return;

    root.classList.add("manlung-startup-complete");
    root.classList.remove("manlung-startup-loading");

    const loader = document.getElementById("manlungStartupLoader");
    if (loader) {
      loader.remove();
    }
  }

  /*
    DOMContentLoaded is intentionally used instead of window.load.
    This means the loader does not wait for large images, external
    resources, analytics, fonts, etc.
  */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finishLoader, { once: true });
  } else {
    finishLoader();
  }

  /* Safety fallback so a broken resource can never keep the loader up. */
  setTimeout(finishLoader, 3000);
})();
