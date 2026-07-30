/* Stable DOM compatibility markers for audited 0.14.7 editor flows. */
function decorateShutterRows() {
  document.querySelectorAll("[data-tapp-id]").forEach((row, index) => {
    const edit = row.querySelector("[data-tapp-edit]");
    if (edit) edit.dataset.tappEdit = String(index);
    row.dataset.tappIndex = String(index);
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  let frame = 0;
  const decorate = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(decorateShutterRows);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", decorate, { once: true });
  } else {
    decorate();
  }
  new MutationObserver(decorate).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
