
(function () {
  const root = document.documentElement;
  root.classList.add("manlung-startup-loading");

  /* Balanced startup intro: visible, but does not wait for the site/network. */
  setTimeout(function () {
    root.classList.add("manlung-startup-complete");
    root.classList.remove("manlung-startup-loading");
  }, 450);
})();
