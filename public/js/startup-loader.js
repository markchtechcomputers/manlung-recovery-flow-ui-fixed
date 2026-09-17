/* Startup loader disabled. The homepage opens directly without a loading screen. */
(function () {
  const root = document.documentElement;
  root.classList.remove("manlung-startup-loading");
  root.classList.add("manlung-startup-complete");
})();
