import { describe, expect, it } from "vitest";

import { resolveSiteBinding, SiteBindingError } from "./site-binding";

describe("site binding", () => {
  it("canonicalizes a deployment homeserver URL", () => {
    expect(
      resolveSiteBinding({
        siteId: "site_01J8MATRIX",
        homeserverUrl: "https://matrix.example.com/",
      })
    ).toBe("https://matrix.example.com");
  });

  it("allows loopback HTTP for local verification", () => {
    expect(resolveSiteBinding({ homeserverUrl: "http://127.0.0.1:8008" })).toBe("http://127.0.0.1:8008");
  });

  it.each([
    [{ homeserverUrl: "http://matrix.example.com" }, "HTTPS"],
    [{ homeserverUrl: "https://matrix.example.com/admin" }, "origin"],
    [{ homeserverUrl: "https://matrix.example.com?tenant=other" }, "origin"],
    [{ siteId: "other-site", homeserverUrl: "https://matrix.example.com" }, "siteId"],
    [{ siteId: "site_01J8MATRIX" }, "homeserverUrl"],
  ])("rejects an unsafe binding %#", (binding, expectedMessage) => {
    expect(() => resolveSiteBinding(binding)).toThrowError(SiteBindingError);
    expect(() => resolveSiteBinding(binding)).toThrow(expectedMessage);
  });
});
