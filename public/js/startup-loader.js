
(function () {
  const root = document.documentElement;
  root.classList.add("manlung-startup-loading");

  /*
    Ultra-fast intro only.
    Does NOT wait for page load, images, network or Supabase.
  */
  setTimeout(function () {
    root.classList.add("manlung-startup-complete");
    root.classList.remove("manlung-startup-loading");
  }, 80);
})();
