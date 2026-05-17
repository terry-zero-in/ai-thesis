import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { htmlToExcerpt } from "./sec.ts";

describe("htmlToExcerpt", () => {
  it("strips HTML tags and collapses whitespace", () => {
    const html = `<html><body><p>Hello <b>world</b></p>\n\n<p>Another line.</p></body></html>`;
    const out = htmlToExcerpt(html);
    assert.equal(out, "Hello world Another line.");
  });

  it("removes script and style blocks", () => {
    const html = `<head><style>.x{color:red}</style></head><body><script>alert(1)</script><p>OK</p></body>`;
    const out = htmlToExcerpt(html);
    assert.match(out, /OK/);
    assert.doesNotMatch(out, /alert/);
    assert.doesNotMatch(out, /color:red/);
  });

  it("decodes common HTML entities", () => {
    const html = `<p>Tom &amp; Jerry &nbsp; Q&amp;A &lt;tag&gt;</p>`;
    const out = htmlToExcerpt(html);
    assert.equal(out, "Tom & Jerry Q&A <tag>");
  });

  it("truncates to maxChars", () => {
    const html = `<p>${"x".repeat(20000)}</p>`;
    const out = htmlToExcerpt(html, 100);
    assert.equal(out.length, 100);
  });

  it("strips inline XBRL tags", () => {
    const html = `<ix:nonNumeric contextRef="ctx">Revenue</ix:nonNumeric> increased.`;
    const out = htmlToExcerpt(html);
    assert.equal(out, "Revenue increased.");
  });
});
