// The contents list of the user manual page (public/help/user-manual.html): it follows the section in the address
// (Help > Open this section) and the reader's scrolling, and the search box narrows it to the matching headings.
(function () {
  var links = {};
  document.querySelectorAll("nav.toc a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
  var heads = Array.prototype.slice.call(document.querySelectorAll("main h1[id], main h2[id]"));
  var current = null;
  function mark(id, scroll) {
    var a = links[id];
    if (!a || a === current) return;
    if (current) current.classList.remove("current");
    a.classList.add("current");
    current = a;
    if (scroll) a.scrollIntoView({ block: "center" });
  }
  function sectionOf(el) {
    // an h3 belongs to the h2 (or h1) above it
    var id = null;
    heads.forEach(function (h) { if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING || h === el) id = h.id; });
    return id;
  }
  function fromHash() {
    var el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) mark(sectionOf(el), true);
  }
  window.addEventListener("hashchange", fromHash);
  window.addEventListener("scroll", function () {
    var top = null;
    heads.forEach(function (h) { if (h.getBoundingClientRect().top < 120) top = h; });
    if (top) mark(top.id, false);
  }, { passive: true });
  var search = document.getElementById("toc-search");
  if (search) {
    search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase();
      document.querySelectorAll("nav.toc > ul > li").forEach(function (chapter) {
        var any = false;
        chapter.querySelectorAll("li").forEach(function (li) {
          var hit = !q || li.textContent.toLowerCase().indexOf(q) >= 0;
          li.hidden = !hit;
          any = any || hit;
        });
        var own = chapter.querySelector("a").textContent.toLowerCase().indexOf(q) >= 0;
        chapter.hidden = !!q && !any && !own;
      });
    });
  }
  fromHash();
})();
