import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  Admin2FAError,
  getAdmin2FAField,
  getAdmin2FASession,
  getEnrollmentFromError,
  submitAdminPassword,
} from "./admin2fa";

describe("admin 2FA response helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("extracts the enrollment URI from the Matrix additional field", () => {
    const error = new Admin2FAError("blocked", 403, {
      "io.auto_release.admin_2fa": {
        challenge_id: "challenge-1",
        flow: "ENROLL",
        otpauth_uri: "otpauth://totp/Ketesa:admin?secret=ONLY_IN_MEMORY",
      },
    });

    expect(getEnrollmentFromError(error)).toEqual({
      challenge_id: "challenge-1",
      otpauth_uri: "otpauth://totp/Ketesa:admin?secret=ONLY_IN_MEMORY",
    });
  });

  it("accepts the server's additional object shape and ignores ordinary errors", () => {
    const field = { challenge_id: "challenge-2", flow: "AUTHENTICATE" };
    expect(getAdmin2FAField(new Admin2FAError("blocked", 403, { additional: field }))).toEqual(field);
    expect(getAdmin2FAField(new Error("ordinary error"))).toBeNull();
    expect(getEnrollmentFromError(new Admin2FAError("blocked", 403, { additional: field }))).toBeNull();
  });

  it("requires an authorized session with at least one factor", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ authorized: true, factor_count: 0 })));
    await expect(getAdmin2FASession("https://site.example", "token")).rejects.toBeInstanceOf(Admin2FAError);
  });

  it("revokes a token if the password preflight unexpectedly succeeds", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "unexpected", user_id: "@user:test", device_id: "device" }))
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({})));

    await submitAdminPassword("https://site.example", "user", "password", "device");

    expect(vi.mocked(fetch).mock.calls[1][0]).toBe("https://site.example/_matrix/client/v3/logout");
    expect((vi.mocked(fetch).mock.calls[1][1] as RequestInit).headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer unexpected",
    });
  });
});
