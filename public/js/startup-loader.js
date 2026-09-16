
/* Manlung Recovery — instant lightweight startup loader */
(function () {
  const root = document.documentElement;

  root.classList.add("manlung-startup-loading");

  function closeLoader() {
    if (root.classList.contains("manlung-startup-complete")) return;

    requestAnimationFrame(function () {
      root.classList.remove("manlung-startup-loading");
      root.classList.add("manlung-startup-complete");

      setTimeout(function () {
        root.classList.remove("manlung-startup-complete");
      }, 300);
    });
  }

  /*
    Do not hold the website hostage to slow assets.
    Maximum loader time is only 700ms.
  */
  if (document.readyState === "interactive" || document.readyState === "complete") {
    setTimeout(closeLoader, 120);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(closeLoader, 120);
    }, { once: true });

    setTimeout(closeLoader, 700);
  }
})();
