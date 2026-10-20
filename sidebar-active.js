/**
 * Mintlify on Windows may emit sidebar hrefs with backslashes (e.g. /payout\apply).
 * That breaks URL matching, so the current page never gets data-active.
 * Normalize hrefs and mark the active sidebar item (HaiPay-style highlight relies on this).
 */
function udNormalizePath(path) {
  if (!path) return "/";
  var cleaned = path.replace(/\\/g, "/").replace(/\.mdx?$/i, "");
  if (cleaned.length > 1 && cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned || "/";
}

function udFixSidebarActive() {
  var current = udNormalizePath(window.location.pathname);
  var links = document.querySelectorAll("#sidebar a[href], #sidebar-content a[href]");

  links.forEach(function (anchor) {
    var raw = anchor.getAttribute("href") || "";
    if (raw.indexOf("\\") !== -1) {
      anchor.setAttribute("href", raw.replace(/\\/g, "/"));
    }

    var href = udNormalizePath(anchor.getAttribute("href"));
    var item = anchor.closest("li");
    if (!item) return;

    var isActive = href === current;
    if (isActive) {
      item.setAttribute("data-active", "true");
      anchor.setAttribute("aria-current", "page");
    } else if (item.hasAttribute("data-active")) {
      item.removeAttribute("data-active");
      if (anchor.getAttribute("aria-current") === "page") {
        anchor.removeAttribute("aria-current");
      }
    }
  });
}

udFixSidebarActive();
window.addEventListener("mintlify:navigate", udFixSidebarActive);
