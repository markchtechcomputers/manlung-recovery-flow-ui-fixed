
/* Manlung Recovery startup loader */
(function () {
  const root = document.documentElement;
  const startedAt = performance.now();

  root.classList.add("manlung-startup-loading");

  function finishLoader() {
    if (root.classList.contains("manlung-startup-complete")) return;

    const elapsed = performance.now() - startedAt;

    /*
      Fast load  -> 1 spin
      Slower load -> 2 spins
      This keeps the loader short while still giving slower connections
      a visible loading animation.
    */
    if (elapsed > 1200) {
      root.classList.add("manlung-loader-double");
      root.style.setProperty("--manlung-loader-duration", "0.95s");
    } else {
      root.style.setProperty("--manlung-loader-duration", "0.85s");
    }

    const spins = elapsed > 1200 ? 2 : 1;
    const duration = elapsed > 1200 ? 1900 : 850;

    setTimeout(function () {
      root.classList.remove("manlung-startup-loading");
      root.classList.add("manlung-startup-complete");

      setTimeout(function () {
        root.classList.remove("manlung-startup-complete");
        root.classList.remove("manlung-loader-double");
      }, 450);
    }, duration);
  }

  if (document.readyState === "complete") {
    finishLoader();
  } else {
    window.addEventListener("load", finishLoader, { once: true });

    /* Safety fallback so a broken/slow resource never traps the user. */
    setTimeout(function () {
      if (!root.classList.contains("manlung-startup-complete")) {
        finishLoader();
      }
    }, 7000);
  }
})();
