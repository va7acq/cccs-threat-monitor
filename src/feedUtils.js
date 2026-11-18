import { XMLParser } from "fast-xml-parser";

const NAMED_ENTITIES = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  ocirc: "ô",
  ucirc: "û",
  ugrave: "ù",
  iuml: "ï",
  icirc: "î",
  Eacute: "É",
  Egrave: "È",
  Agrave: "À",
  Ccedil: "Ç",
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "entry" || name === "link",
});

export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function decodeHtmlEntities(input) {
  if (!input || typeof input !== "string") return "";

  const decodeOnce = (text) =>
    text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z0-9]+);/g, (full, entity) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const code = parseInt(entity.slice(2), 16);
        if (!Number.isNaN(code) && code > 0 && code <= 0x10ffff) {
          return String.fromCodePoint(code);
        }
        return full;
      }
      if (entity.startsWith("#")) {
        const code = parseInt(entity.slice(1), 10);
        if (!Number.isNaN(code) && code > 0 && code <= 0x10ffff) {
          return String.fromCodePoint(code);
        }
        return full;
      }
      if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, entity)) {
        return NAMED_ENTITIES[entity];
      }
      return full;
    });

  // Decode up to twice to handle double-encoded entities in XML-wrapped HTML
  return decodeOnce(decodeOnce(input));
}

export function extractNodeValue(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (typeof node === "object") {
    if (typeof node["#text"] === "string" || typeof node["#text"] === "number") {
      return String(node["#text"]);
    }
    // Fallback for nested XHTML structures if present
    const parts = [];
    for (const [key, val] of Object.entries(node)) {
      if (key.startsWith("@_")) continue;
      if (Array.isArray(val)) {
        parts.push(val.map(extractNodeValue).join("\n"));
      } else {
        parts.push(extractNodeValue(val));
      }
    }
    return parts.filter(Boolean).join("\n");
  }
  return "";
}

export function htmlToPlainText(rawHtml) {
  if (!rawHtml) return "";
  let text = String(rawHtml).replace(/\r\n?/g, "\n");

  // If HTML tags are still entity-escaped (e.g. &lt;p&gt;), decode once before tag processing
  if (!/<[a-zA-Z!/]/.test(text) && /&lt;\/?[a-zA-Z]/.test(text)) {
    text = decodeHtmlEntities(text);
  }

  // Remove comments, script, and style blocks completely
  text = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  // Preserve readable structure for line breaks, lists, headings, tables, and paragraphs
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "  ")
    .replace(/<tr\b[^>]*>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(
      /<(p|div|section|article|header|footer|blockquote|pre|ul|ol|table|dl|dt|dd|h[1-6])\b[^>]*>/gi,
      "\n\n"
    )
    .replace(
      /<\/(p|div|section|article|header|footer|blockquote|pre|ul|ol|table|dl|h[1-6])>/gi,
      "\n\n"
    );

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Normalize horizontal whitespace per line and collapse excessive blank lines
  text = text
    .replace(/\u00A0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

export function parseAtomFeed(xmlString) {
  if (!xmlString || typeof xmlString !== "string") {
    throw new Error("Empty or invalid XML feed response");
  }

  const parsed = xmlParser.parse(xmlString);
  const feed = parsed?.feed;
  if (!feed) {
    throw new Error("Response does not contain a valid Atom <feed> element");
  }

  const rawEntries = Array.isArray(feed.entry) ? feed.entry : [];

  return rawEntries
    .map((entry) => {
      const id = extractNodeValue(entry.id).trim();
      const title = htmlToPlainText(extractNodeValue(entry.title)) || "Untitled Advisory";

      const rawContent = extractNodeValue(entry.content).trim();
      const rawSummary = extractNodeValue(entry.summary).trim();
      const bodySource = rawContent || rawSummary;
      const body = htmlToPlainText(bodySource);

      const updated =
        extractNodeValue(entry.updated).trim() ||
        extractNodeValue(entry.published).trim() ||
        new Date().toISOString();

      const links = Array.isArray(entry.link) ? entry.link : [];
      const alternateLink = links.find((l) => l && l["@_rel"] === "alternate" && l["@_href"]);
      const fallbackLink = links.find((l) => l && l["@_href"]);
      const url = (alternateLink?.["@_href"] || fallbackLink?.["@_href"] || "").trim();

      return {
        id: id || url || `${title}-${updated}`,
        title,
        body,
        updated,
        url,
      };
    })
    .filter((entry) => Boolean(entry.id));
}

export function splitKeywords(keywords = []) {
  const exclusions = [];
  const positives = [];

  for (const raw of keywords) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("-")) {
      const stripped = trimmed.slice(1).trim();
      if (stripped) {
        exclusions.push(stripped);
      }
    } else {
      positives.push(trimmed);
    }
  }

  return { exclusions, positives };
}

export function buildExclusionRegex(term) {
  const escaped = escapeRegExp(term);
  const prefix = /^\w/.test(term) ? "\\b" : "(?<!\\w)";
  const suffix = /\w$/.test(term) ? "\\b" : "(?!\\w)";
  return new RegExp(`${prefix}${escaped}${suffix}`, "i");
}

export function evaluateEntryAgainstKeywords(entry, keywords = []) {
  const { exclusions, positives } = splitKeywords(keywords);
  const titleText = String(entry?.title || "");

  // 1. Veto-First Evaluation: test every exclusion term against title using case-insensitive word-boundary regex
  for (const exTerm of exclusions) {
    const regex = buildExclusionRegex(exTerm);
    if (regex.test(titleText)) {
      return {
        matched: false,
        excluded: true,
        excludedBy: exTerm,
        matchedKeywords: [],
      };
    }
  }

  // 2. Positive watch terms: case-insensitive substring matching against title
  const lowerTitle = titleText.toLowerCase();
  const matchedKeywords = positives.filter((posTerm) =>
    lowerTitle.includes(posTerm.toLowerCase())
  );

  return {
    matched: matchedKeywords.length > 0,
    excluded: false,
    excludedBy: null,
    matchedKeywords,
  };
}
