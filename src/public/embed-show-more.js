document.addEventListener("click", function (e) {
  var summary = e.target.closest("details.embed-show-more summary");
  if (!summary) return;
  e.preventDefault();
  e.stopPropagation();
  var details = summary.closest("details");
  if (details) {
    details.open = !details.open;
  }
});
