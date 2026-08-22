import { describe, expect, test } from "bun:test";
import { escapeHtml } from "./html.ts";

describe("escapeHtml", () => {
	test("escapes markup and quotes", () => {
		expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
			"&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
		);
	});

	test("leaves plain names unchanged", () => {
		expect(escapeHtml("acald-creator/security-compliance-hub")).toBe(
			"acald-creator/security-compliance-hub",
		);
	});
});
