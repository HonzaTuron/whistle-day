import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { GoogleIcon } from "./GoogleIcon";

describe("GoogleIcon", () => {
  test("renders svg with standard 4-color google paths", () => {
    const html = renderToString(<GoogleIcon className="account__provider-icon" />);
    expect(html).toContain("<svg");
    expect(html).toContain('class="account__provider-icon"');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('fill="#4285F4"');
    expect(html).toContain('fill="#34A853"');
    expect(html).toContain('fill="#FBBC05"');
    expect(html).toContain('fill="#EA4335"');
  });
});
