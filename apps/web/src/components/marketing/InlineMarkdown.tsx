import type { ReactNode } from "react";

const INLINE_MARKDOWN_REGEX =
  /(`[^`]+`|\*\*\*(?!\s)[^*]+?(?<!\s)\*\*\*|\*\*(?!\s)[^*]+?(?<!\s)\*\*|~~(?!\s)[^~]+?(?<!\s)~~|\[[^\]]+\]\([^)]+\)|\*(?!\s)[^*]+?(?<!\s)\*)/g;

/**
 * Parses inline markdown tokens (code, bold, italic, strikethrough, links)
 * into React elements for marketing prose without pulling in a heavyweight
 * AST markdown parser.
 */
export function renderInlineMarkdown(text: string): ReactNode {
  if (!text) return null;
  // Fast path: if no markdown formatting characters are present, return string as-is
  if (!text.includes("`") && !text.includes("*") && !text.includes("~") && !text.includes("[")) {
    return text;
  }

  const parts = text.split(INLINE_MARKDOWN_REGEX);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (!part) return null;

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }

    if (part.startsWith("***") && part.endsWith("***") && part.length >= 6) {
      return (
        <strong key={i}>
          <em>{renderInlineMarkdown(part.slice(3, -3))}</em>
        </strong>
      );
    }

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return <strong key={i}>{renderInlineMarkdown(part.slice(2, -2))}</strong>;
    }

    if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      return <del key={i}>{renderInlineMarkdown(part.slice(2, -2))}</del>;
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return <em key={i}>{renderInlineMarkdown(part.slice(1, -1))}</em>;
    }

    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        const [, label, href] = match;
        const isExternal = /^https?:\/\//i.test(href);
        return (
          <a
            key={i}
            href={href}
            {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {renderInlineMarkdown(label)}
          </a>
        );
      }
    }

    return part;
  });
}
