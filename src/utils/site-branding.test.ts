import { describe, expect, it } from "vitest";

import { getSiteBranding } from "./site-branding";

describe("site branding", () => {
  it("builds the admin identity from the published app and server names", () => {
    expect(
      getSiteBranding({
        siteId: "site_000014",
        homeserverUrl: "https://im.unseal.build",
        serverName: "im.unseal.build",
        appName: "Unseal",
      })
    ).toEqual({
      adminName: "Unseal后台",
      appName: "Unseal",
      serverName: "im.unseal.build",
      initial: "U",
    });
  });

  it("falls back to the homeserver hostname", () => {
    expect(getSiteBranding({ homeserverUrl: "https://matrix.example.com" })).toEqual({
      adminName: "matrix.example.com后台",
      appName: "matrix.example.com",
      serverName: "matrix.example.com",
      initial: "M",
    });
  });
});
