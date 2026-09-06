import { describe, expect, it } from "vitest";

import { stripRestrictedUserEditFields } from "./Edit";

describe("existing-user edit restrictions", () => {
  it("preserves ordinary edits while dropping password and contact mutations", () => {
    expect(
      stripRestrictedUserEditFields({
        id: "@alice:example.org",
        displayname: "Alice",
        password: "should-not-be-sent",
        threepids: [{ medium: "email", address: "alice@example.org" }],
      })
    ).toEqual({ id: "@alice:example.org", displayname: "Alice" });
  });
});
