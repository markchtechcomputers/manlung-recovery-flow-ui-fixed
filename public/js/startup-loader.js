
(function () {
  const root = document.documentElement;
  root.classList.add("manlung-startup-loading");

  /* Very short visual intro — never waits for network/page resources. */
  setTimeout(function () {
    root.classList.add("manlung-startup-complete");

    setTimeout(function () {
      root.classList.remove("manlung-startup-loading");
      root.classList.remove("manlung-startup-complete");
    }, 300);
  }, 250);
})();
