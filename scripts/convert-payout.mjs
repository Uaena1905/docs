import fs from "node:fs";
import path from "node:path";

const SRC = "C:\\Users\\z9870\\AppData\\Local\\Temp\\ugame_docs";
const ROOT = "d:\\projects\\docs";

const MAP = [
  {
    html: "proxyApi.html",
    out: "payout/apply.mdx",
    title: "代付支付下单接口",
  },
  {
    html: "proxyAsync.html",
    out: "payout/async-callback.mdx",
    title: "代付异步支付回调",
  },
  {
    html: "proxyOrder.html",
    out: "payout/order-query.mdx",
    title: "代付订单查询",
  },
  {
    html: "payoutIntro.html",
    out: "payout/intro.mdx",
    title: "代付产品说明",
  },
  {
    html: "proxyMethodAll.html",
    out: "payout/methods/global.mdx",
    title: "全球代付支付方式",
  },
  {
    html: "proxyMethodKorea.html",
    out: "payout/methods/korea.mdx",
    title: "韩国代付支付方式",
  },
  {
    html: "proxyMethodVietnam.html",
    out: "payout/methods/vietnam.mdx",
    title: "越南代付支付方式",
  },
  {
    html: "proxyMethodIndonesia.html",
    out: "payout/methods/indonesia.mdx",
    title: "印度尼西亚代付支付方式",
  },
  {
    html: "proxyMethodMalaysia.html",
    out: "payout/methods/malaysia.mdx",
    title: "马来西亚代付支付方式",
  },
  {
    html: "proxyMethodPakistan.html",
    out: "payout/methods/pakistan.mdx",
    title: "巴基斯坦代付支付方式",
  },
  {
    html: "proxyMethodEgypt.html",
    out: "payout/methods/egypt.mdx",
    title: "埃及代付支付方式",
  },
  {
    html: "proxyMethodThailand.html",
    out: "payout/methods/thailand.mdx",
    title: "泰国代付支付方式",
  },
  {
    html: "proxyMethodPhilippines.html",
    out: "payout/methods/philippines.mdx",
    title: "菲律宾代付支付方式",
  },
];

function decode(html) {
  return html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTags(html) {
  return decode(String(html).replace(/<[^>]+>/g, "")).trim();
}

function mapLocal(url) {
  const map = {
    proxyApi: "/payout/apply",
    proxyAsync: "/payout/async-callback",
    proxyOrder: "/payout/order-query",
    payoutIntro: "/payout/intro",
    proxyMethodAll: "/payout/methods/global",
    proxyMethodKorea: "/payout/methods/korea",
    proxyMethodVietnam: "/payout/methods/vietnam",
    proxyMethodIndonesia: "/payout/methods/indonesia",
    proxyMethodMalaysia: "/payout/methods/malaysia",
    proxyMethodPakistan: "/payout/methods/pakistan",
    proxyMethodEgypt: "/payout/methods/egypt",
    proxyMethodThailand: "/payout/methods/thailand",
    proxyMethodPhilippines: "/payout/methods/philippines",
  };
  const m = String(url).match(/[?&]a=([A-Za-z0-9_]+)/);
  if (!m) return null;
  return map[m[1]] || null;
}

function rewriteHref(href) {
  let url = decode(href.replace(/&amp;/g, "&"));
  if (url.startsWith("/")) url = `https://docs.ugamedeal.com${url}`;
  return mapLocal(url) || url;
}

function inlineToMd(html) {
  let s = html;
  s = s.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => `[${stripTags(text)}](${rewriteHref(href)})`
  );
  s = s.replace(/<\/?strong>/gi, "**");
  s = s.replace(/<\/?b>/gi, "**");
  s = s.replace(/<\/?em>/gi, "*");
  s = s.replace(/<\/?code>/gi, "`");
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = stripTags(s).replace(/\|/g, "\\|");
  return s.replace(/\s+/g, " ").trim();
}

function findMatchingClose(html, openTagEndIndex, tagName) {
  // openTagEndIndex is index after '>' of opening tag
  const openRe = new RegExp(`<${tagName}(\\s[^>]*)?>`, "gi");
  const closeRe = new RegExp(`</${tagName}>`, "gi");
  let depth = 1;
  let i = openTagEndIndex;
  while (i < html.length && depth > 0) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const open = openRe.exec(html);
    const close = closeRe.exec(html);
    if (!close) return -1;
    if (open && open.index < close.index) {
      // self-closing-ish skip? treat as open
      if (/\/>$/.test(open[0])) {
        i = open.index + open[0].length;
        continue;
      }
      depth++;
      i = open.index + open[0].length;
    } else {
      depth--;
      if (depth === 0) return close.index;
      i = close.index + close[0].length;
    }
  }
  return -1;
}

function extractBlocks(html, tagName, classIncludes) {
  const results = [];
  const re = new RegExp(`<${tagName}(\\s[^>]*)?>`, "gi");
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || "";
    if (classIncludes && !attrs.includes(classIncludes)) continue;
    const openEnd = m.index + m[0].length;
    const closeStart = findMatchingClose(html, openEnd, tagName);
    if (closeStart < 0) continue;
    const inner = html.slice(openEnd, closeStart);
    const full = html.slice(m.index, closeStart + `</${tagName}>`.length);
    results.push({ index: m.index, end: closeStart + `</${tagName}>`.length, attrs, inner, full });
    re.lastIndex = closeStart + `</${tagName}>`.length;
  }
  return results;
}

function tableToMd(tableHtml) {
  const rowHtmls = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(
    (m) => m[1]
  );
  if (!rowHtmls.length) return "";

  // Expand rowspan for first-column country cells
  const pending = []; // {cols left values by column index}
  const rows = [];
  for (const rowHtml of rowHtmls) {
    const cells = [
      ...rowHtml.matchAll(/<(th|td)([^>]*)>([\s\S]*?)<\/\1>/gi),
    ].map((m) => {
      const attrs = m[2] || "";
      const rowspan = Number((attrs.match(/rowspan="(\d+)"/i) || [])[1] || 1);
      return { text: inlineToMd(m[3]), rowspan, isTh: m[1].toLowerCase() === "th" };
    });

    const built = [];
    let ci = 0;
    let cellIdx = 0;
    while (cellIdx < cells.length || pending.some((p) => p && p.left > 0)) {
      if (pending[ci] && pending[ci].left > 0) {
        built.push(pending[ci].text);
        pending[ci].left -= 1;
        if (pending[ci].left === 0) pending[ci] = null;
        ci++;
        continue;
      }
      if (cellIdx >= cells.length) break;
      const cell = cells[cellIdx++];
      built.push(cell.text);
      if (cell.rowspan > 1) {
        pending[ci] = { text: cell.text, left: cell.rowspan - 1 };
      }
      ci++;
    }
    rows.push(built);
  }

  const colCount = Math.max(...rows.map((r) => r.length));
  const pad = (r) => {
    const x = [...r];
    while (x.length < colCount) x.push("");
    return x;
  };

  const header = pad(rows[0]);
  const body = rows.slice(1).map(pad);
  const lines = [];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${header.map(() => "---").join(" | ")} |`);
  for (const r of body) lines.push(`| ${r.join(" | ")} |`);
  return lines.join("\n");
}

function codeToMd(blockHtml) {
  const codeMatch = blockHtml.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
  let code = codeMatch ? codeMatch[1] : blockHtml;
  code = code.replace(/<span[^>]*>/gi, "").replace(/<\/span>/gi, "");
  code = decode(code).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!code.endsWith("\n")) code += "\n";
  return "```json\n" + code + "```";
}

function listToMd(ulHtml) {
  return [...ulHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => `- ${inlineToMd(m[1])}`)
    .join("\n");
}

function convertMain(mainHtml) {
  let html = mainHtml;

  const headerMatch = html.match(
    /<header class="page-header">([\s\S]*?)<\/header>/i
  );
  let introP = "";
  if (headerMatch) {
    const p = headerMatch[1].match(/<p>([\s\S]*?)<\/p>/i);
    if (p) introP = stripTags(p[1]);
    html = html.replace(headerMatch[0], "");
  }

  // Walk content in document order using a token scan of top-level meaningful nodes inside remaining HTML
  // Strategy: replace known blocks with placeholders that sort by position
  const replacements = [];

  const addAll = (items, toMd) => {
    for (const it of items) {
      replacements.push({ index: it.index, end: it.end, md: toMd(it) });
    }
  };

  // code blocks (div.code-block-dark) — use balanced match
  {
    const re = /<div(\s[^>]*class="[^"]*code-block-dark[^"]*"[^>]*)>/gi;
    let m;
    while ((m = re.exec(html))) {
      const openEnd = m.index + m[0].length;
      const closeStart = findMatchingClose(html, openEnd, "div");
      if (closeStart < 0) continue;
      const full = html.slice(m.index, closeStart + 6);
      replacements.push({
        index: m.index,
        end: closeStart + 6,
        md: codeToMd(full),
      });
      re.lastIndex = closeStart + 6;
    }
  }

  // tables
  {
    const re = /<table(\s[^>]*)?>/gi;
    let m;
    while ((m = re.exec(html))) {
      const openEnd = m.index + m[0].length;
      const closeStart = findMatchingClose(html, openEnd, "table");
      if (closeStart < 0) continue;
      const full = html.slice(m.index, closeStart + 8);
      // skip if inside already scheduled range
      if (replacements.some((r) => m.index >= r.index && m.index < r.end)) {
        re.lastIndex = closeStart + 8;
        continue;
      }
      replacements.push({
        index: m.index,
        end: closeStart + 8,
        md: tableToMd(full),
      });
      re.lastIndex = closeStart + 8;
    }
  }

  // headings h2/h3/h4
  for (const level of [2, 3, 4]) {
    const re = new RegExp(`<h${level}([^>]*)>([\\s\\S]*?)<\\/h${level}>`, "gi");
    let m;
    while ((m = re.exec(html))) {
      if (replacements.some((r) => m.index >= r.index && m.index < r.end))
        continue;
      const text = stripTags(m[2]);
      let mdLevel = level;
      // intro page section titles that are h3 keep as ## for product sections when they start with 一、二、三、相关
      if (/^(一、|二、|三、|相关文档)/.test(text)) mdLevel = 2;
      else if (level === 3) mdLevel = 3;
      else if (level === 4 && /doc-section-title/.test(m[1] || "")) mdLevel = 2;
      replacements.push({
        index: m.index,
        end: m.index + m[0].length,
        md: `${"#".repeat(mdLevel)} ${text}`,
      });
    }
  }

  // ul
  {
    const re = /<ul(\s[^>]*)?>/gi;
    let m;
    while ((m = re.exec(html))) {
      const openEnd = m.index + m[0].length;
      const closeStart = findMatchingClose(html, openEnd, "ul");
      if (closeStart < 0) continue;
      if (replacements.some((r) => m.index >= r.index && m.index < r.end)) {
        re.lastIndex = closeStart + 5;
        continue;
      }
      const full = html.slice(m.index, closeStart + 5);
      replacements.push({
        index: m.index,
        end: closeStart + 5,
        md: listToMd(full),
      });
      re.lastIndex = closeStart + 5;
    }
  }

  // feature items
  {
    const re =
      /<div class="feature-item">\s*<div class="feature-num">([\s\S]*?)<\/div>\s*<div class="feature-text">([\s\S]*?)<\/div>\s*<\/div>/gi;
    let m;
    while ((m = re.exec(html))) {
      if (replacements.some((r) => m.index >= r.index && m.index < r.end))
        continue;
      replacements.push({
        index: m.index,
        end: m.index + m[0].length,
        md: `- ${stripTags(m[1])}. ${stripTags(m[2])}`,
      });
    }
  }

  // process steps
  {
    const re = /<p class="process-step">([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = re.exec(html))) {
      if (replacements.some((r) => m.index >= r.index && m.index < r.end))
        continue;
      replacements.push({
        index: m.index,
        end: m.index + m[0].length,
        md: `- ${inlineToMd(m[1])}`,
      });
    }
  }

  // paragraphs
  {
    const re = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = re.exec(html))) {
      if (replacements.some((r) => m.index >= r.index && m.index < r.end))
        continue;
      if (/process-step/.test(m[1] || "")) continue;
      const text = inlineToMd(m[2]);
      if (!text) continue;
      replacements.push({
        index: m.index,
        end: m.index + m[0].length,
        md: text,
      });
    }
  }

  replacements.sort((a, b) => a.index - b.index);

  // Drop overlapping (keep earlier)
  const kept = [];
  let cursor = 0;
  for (const r of replacements) {
    if (r.index < cursor) continue;
    kept.push(r);
    cursor = r.end;
  }

  const body = kept
    .map((r) => r.md)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { introP, body };
}

function wrapTables(body, className = "pay-table-wrap") {
  const lines = body.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("|") && lines[i + 1]?.includes("---")) {
      out.push(`<div className="${className}">`, "");
      while (i < lines.length && lines[i].startsWith("|")) {
        out.push(lines[i]);
        i++;
      }
      out.push("", "</div>");
      continue;
    }
    out.push(lines[i]);
    i++;
  }
  return out.join("\n");
}

function endpointBadge(kind) {
  if (kind === "apply") {
    return `<div className="api-endpoint">
  <span className="api-method api-method-post">POST</span>
  <code className="api-path">https://{"{测试/线上环境域名}"}/payout/applypayout.php</code>
</div>`;
  }
  if (kind === "order") {
    return `<div className="api-endpoint">
  <span className="api-method api-method-post">POST</span>
  <code className="api-path">https://{"{测试/线上环境域名}"}/payout/checkpayout.php</code>
</div>`;
  }
  if (kind === "async") {
    return `<div className="api-endpoint">
  <span className="api-method api-method-callback">CALLBACK</span>
  <code className="api-path">商户 payCallbackUrl</code>
</div>`;
  }
  return "";
}

const stats = [];

for (const item of MAP) {
  const raw = fs.readFileSync(path.join(SRC, item.html), "utf8");
  const mainMatch = raw.match(
    /<main class="main-content">([\s\S]*?)<\/main>/i
  );
  if (!mainMatch) throw new Error(`No main in ${item.html}`);

  const { introP, body: rawBody } = convertMain(mainMatch[1]);
  const wrapClass = item.out.includes("/methods/")
    ? "pay-table-wrap"
    : item.out === "payout/intro.mdx"
      ? "scene-table-wrap"
      : "api-table-wrap";
  let body = wrapTables(rawBody, wrapClass);

  const description = introP || item.title;

  let prefix = "";
  if (item.out === "payout/apply.mdx") prefix = endpointBadge("apply") + "\n\n";
  if (item.out === "payout/order-query.mdx")
    prefix = endpointBadge("order") + "\n\n";
  if (item.out === "payout/async-callback.mdx")
    prefix = endpointBadge("async") + "\n\n";

  const introBlock =
    introP && !body.startsWith(introP) ? `${introP}\n\n` : "";

  const mdx = `---
title: "${item.title}"
description: "${description.replace(/"/g, '\\"')}"
---

${introBlock}${prefix}${body}
`.replace(/\n{3,}/g, "\n\n");

  const outPath = path.join(ROOT, item.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, mdx.trim() + "\n", "utf8");

  const tableLines = mdx.split("\n").filter((l) => l.startsWith("|"));
  // Count data rows across all tables: for method pages one table; subtract 2 per table
  let dataRows = 0;
  let i = 0;
  const lines = mdx.split("\n");
  while (i < lines.length) {
    if (lines[i].startsWith("|") && lines[i + 1]?.includes("---")) {
      i += 2;
      let n = 0;
      while (i < lines.length && lines[i].startsWith("|")) {
        n++;
        i++;
      }
      dataRows += n;
    } else i++;
  }

  stats.push({ out: item.out, dataRows, hasResult: mdx.includes("结果说明") || mdx.includes("返回结果代码") });
  console.log(
    `OK ${item.out} dataRows=${dataRows} hasResultSection=${stats.at(-1).hasResult}`
  );
}

console.log(JSON.stringify(stats, null, 2));
