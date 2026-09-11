import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInlineMarkdown } from "./InlineMarkdown";

describe("renderInlineMarkdown", () => {
  it("returns plain text unchanged", () => {
    expect(renderInlineMarkdown("Hello world")).toBe("Hello world");
  });

  it("renders bold text", () => {
    const html = renderToStaticMarkup(<>{renderInlineMarkdown("This is **bold** text")}</>);
    expect(html).toBe("This is <strong>bold</strong> text");
  });

  it("renders inline code", () => {
    const html = renderToStaticMarkup(<>{renderInlineMarkdown("Run `create_tournament` now")}</>);
    expect(html).toBe("Run <code>create_tournament</code> now");
  });

  it("renders italic text", () => {
    const html = renderToStaticMarkup(<>{renderInlineMarkdown("An *italic* word")}</>);
    expect(html).toBe("An <em>italic</em> word");
  });

  it("renders bold and italic text", () => {
    const html = renderToStaticMarkup(<>{renderInlineMarkdown("***important*** note")}</>);
    expect(html).toBe("<strong><em>important</em></strong> note");
  });

  it("renders links", () => {
    const html = renderToStaticMarkup(
      <>{renderInlineMarkdown("See [Smithery](https://smithery.ai) or [/docs](/docs)")}</>
    );
    expect(html).toBe(
      'See <a href="https://smithery.ai" target="_blank" rel="noopener noreferrer">Smithery</a> or <a href="/docs">/docs</a>'
    );
  });

  it("renders mixed bold and code", () => {
    const html = renderToStaticMarkup(
      <>{renderInlineMarkdown("**Setup:** `create_tournament` (football, chess)")}</>
    );
    expect(html).toBe(
      "<strong>Setup:</strong> <code>create_tournament</code> (football, chess)"
    );
  });

  it("does not treat snake_case identifiers as italics", () => {
    const html = renderToStaticMarkup(
      <>{renderInlineMarkdown("generate_stage takes a dry_run to test")}</>
    );
    expect(html).toBe("generate_stage takes a dry_run to test");
  });

  it("does not treat math multiplication as italics", () => {
    const html = renderToStaticMarkup(
      <>{renderInlineMarkdown("3 * 4 = 12 * 1")}</>
    );
    expect(html).toBe("3 * 4 = 12 * 1");
  });
});
