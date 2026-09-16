/* Manlung Recovery startup loader */
(function () {
  const root = document.documentElement;
  root.classList.add("manlung-startup-loading");

  const start = Date.now();
  const minimumVisibleTime = 850;

  function finishStartupLoader() {
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, minimumVisibleTime - elapsed);

    setTimeout(function () {
      root.classList.remove("manlung-startup-loading");
      root.classList.add("manlung-startup-complete");

      setTimeout(function () {
        root.classList.remove("manlung-startup-complete");
      }, 650);
    }, remaining);
  }

  if (document.readyState === "complete") {
    finishStartupLoader();
  } else {
    window.addEventListener("load", finishStartupLoader, { once: true });

    setTimeout(function () {
      if (!root.classList.contains("manlung-startup-complete")) {
        finishStartupLoader();
      }
    }, 8000);
  }
})();
