vi.mock("oidc-client-ts", () => {
  return {
    UserManager: vi.fn(function UserManager() {
      return {
        signinRedirectCallback: vi.fn().mockResolvedValue({
          access_token: "oidc_access_token",
          refresh_token: "oidc_refresh_token",
          id_token: "oidc_id_token",
          expires_in: 3600,
        }),
      };
    }),
  };
});

vi.mock("../data", () => ({
  initResources: vi.fn(),
}));

vi.mock("../data/mas", async () => ({
  ...(await vi.importActual("../data/mas")),
  detectAndSetMAS: vi.fn().mockResolvedValue(undefined),
}));

import { HttpError } from "ra-core";

import authProvider from "./index";
import { initResources } from "../data";
import { UserManager } from "oidc-client-ts";
import { LoadConfig } from "../../utils/config";

describe("authProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("login", () => {
    it("should successfully login with username and password", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            home_server: "example.com",
            user_id: "@user:example.com",
            access_token: "foobar",
            device_id: "some_device",
          })
        )
      );
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({})));

      const ret = await authProvider.login({
        base_url: "http://example.com",
        username: "@user:example.com",
        password: "secret",
      });

      expect(ret).toEqual({ redirectTo: "/" });
      expect(fetch).toHaveBeenCalledWith("http://example.com/_matrix/client/v3/login", {
        body: '{"device_id":null,"initial_device_display_name":"Ketesa","type":"m.login.password","identifier":{"type":"m.id.user","user":"@user:example.com"},"password":"secret"}',
        headers: new Headers({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        credentials: "same-origin",
        method: "POST",
      });
      expect(localStorage.getItem("base_url")).toEqual("http://example.com");
      expect(localStorage.getItem("user_id")).toEqual("@user:example.com");
      expect(localStorage.getItem("access_token")).toEqual("foobar");
      expect(localStorage.getItem("device_id")).toEqual("some_device");
      expect(localStorage.getItem("home_server")).toEqual("example.com");
    });

    it("extracts home_server from user_id, ignoring the deprecated home_server field", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            home_server: "deprecated.should-be-ignored.example.com",
            user_id: "@admin:actual.example.com",
            access_token: "tok",
            device_id: "dev",
          })
        )
      );
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({})));

      await authProvider.login({
        base_url: "http://actual.example.com",
        username: "@admin:actual.example.com",
        password: "pass",
      });

      expect(localStorage.getItem("home_server")).toEqual("actual.example.com");
    });

    it("throws when user_id is missing from the login response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "tok",
            device_id: "dev",
          })
        )
      );

      await expect(
        authProvider.login({
          base_url: "http://example.com",
          username: "@admin:example.com",
          password: "pass",
        })
      ).rejects.toBeDefined();
    });

    it("extracts home_server with port from user_id", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user_id: "@admin:example.com:8008",
            access_token: "tok",
            device_id: "dev",
          })
        )
      );
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({})));

      await authProvider.login({
        base_url: "http://example.com:8008",
        username: "@admin:example.com:8008",
        password: "pass",
      });

      expect(localStorage.getItem("home_server")).toEqual("example.com:8008");
    });
  });

  it("should successfully login with token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          home_server: "example.com",
          user_id: "@user:example.com",
          access_token: "foobar",
          device_id: "some_device",
        })
      )
    );
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({})));

    const ret = await authProvider.login({
      base_url: "https://example.com/",
      loginToken: "login_token",
    });

    expect(ret).toEqual({ redirectTo: "/" });
    expect(fetch).toHaveBeenCalledWith("https://example.com/_matrix/client/v3/login", {
      body: '{"device_id":null,"initial_device_display_name":"Ketesa","type":"m.login.token","token":"login_token"}',
      headers: new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
      credentials: "same-origin",
      method: "POST",
    });
    expect(localStorage.getItem("base_url")).toEqual("https://example.com");
    expect(localStorage.getItem("user_id")).toEqual("@user:example.com");
    expect(localStorage.getItem("access_token")).toEqual("foobar");
    expect(localStorage.getItem("device_id")).toEqual("some_device");
  });

  it("handles OIDC callback via oidc-client-ts", async () => {
    localStorage.setItem("clientId", "client_id");
    localStorage.setItem("oidc_issuer", "https://issuer.example");
    localStorage.setItem("oidc_scope", "openid profile");
    localStorage.setItem("oidc_redirect_uri", "http://localhost:5173/auth-callback/");
    localStorage.setItem("decoded_base_url", "http://example.com");

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user_id: "@user:example.com",
          device_id: "DEVICE",
        })
      )
    );
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({})));

    const result = await authProvider.handleCallback?.();

    expect(UserManager).toHaveBeenCalledWith({
      authority: "https://issuer.example",
      client_id: "client_id",
      redirect_uri: "http://localhost:5173/auth-callback/",
      response_type: "code",
      scope: "openid profile",
    });
    const userManagerInstance = vi.mocked(UserManager).mock.results[0].value;
    expect(userManagerInstance.signinRedirectCallback).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("access_token")).toBe("oidc_access_token");
    expect(localStorage.getItem("refresh_token")).toBe("oidc_refresh_token");
    expect(localStorage.getItem("id_token")).toBe("oidc_id_token");
    expect(localStorage.getItem("login_type")).toBe("credentials");
    expect(initResources).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ redirectTo: "/" });
  });

  describe("logout", () => {
    it("should remove the access_token from storage", async () => {
      localStorage.setItem("base_url", "example.com");
      localStorage.setItem("access_token", "foo");
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({})));

      await authProvider.logout(null);

      expect(fetch).toHaveBeenCalledWith("example.com/_matrix/client/v3/logout", {
        headers: new Headers({
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: "Bearer foo",
        }),
        method: "POST",
        credentials: "same-origin",
        user: { authenticated: true, token: "Bearer foo" },
      });
      expect(localStorage.getItem("access_token")).toBeNull();
    });
  });

  describe("checkError", () => {
    it("should resolve if error.status is not 401", async () => {
      await expect(authProvider.checkError({ status: 200 })).resolves.toBeUndefined();
    });

    it("should reject if error.status is 401", async () => {
      await expect(
        authProvider.checkError(new HttpError("test-error", 401, { errcode: "test-errcode", error: "test-error" }))
      ).rejects.toBeDefined();
    });
  });

  describe("checkAuth", () => {
    it("should reject when not logged in", async () => {
      await expect(authProvider.checkAuth({})).rejects.toBeUndefined();
    });

    it("should resolve when logged in", async () => {
      localStorage.setItem("access_token", "foobar");

      await expect(authProvider.checkAuth({})).resolves.toBeUndefined();
    });
  });

  describe("getPermissions", () => {
    it("should do nothing", async () => {
      if (authProvider.getPermissions) {
        await expect(authProvider.getPermissions(null)).resolves.toBeUndefined();
      }
    });
  });

  it("rejects a pre-existing Site Admin token without 2FA assurance", async () => {
    LoadConfig({
      siteBinding: { siteId: "site_old_token", homeserverUrl: "https://site.example" },
      corsCredentials: "same-origin",
    });
    localStorage.setItem("base_url", "https://site.example");
    localStorage.setItem("access_token", "old-admin-token");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ authorized: false, factor_count: 0 })));

    await expect(authProvider.checkAuth?.({})).rejects.toBeUndefined();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("base_url")).toBeNull();
  });

  describe("Site Admin 2FA final login", () => {
    it("uses the challenge device, checks assurance before persistence, then initializes the session", async () => {
      LoadConfig({
        siteBinding: { siteId: "site_test", homeserverUrl: "https://site.example" },
        corsCredentials: "same-origin",
      });
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              user_id: "@admin:site.example",
              access_token: "admin-token",
              device_id: "challenge-device",
            })
          )
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ authorized: true, factor_count: 1 })))
        .mockResolvedValueOnce(new Response(JSON.stringify({})));

      await expect(
        authProvider.login({
          base_url: "https://site.example",
          username: "@admin:site.example",
          password: "in-memory",
          admin2fa: { challengeId: "challenge-1", deviceId: "challenge-device" },
        })
      ).resolves.toEqual({ redirectTo: "/" });

      const loginCall = vi.mocked(fetch).mock.calls[0];
      expect(loginCall[0]).toBe("https://site.example/_matrix/client/v3/login");
      expect(JSON.parse(String((loginCall[1] as RequestInit).body)).device_id).toBe("challenge-device");
      expect(vi.mocked(fetch).mock.calls[1][0]).toBe("https://site.example/_synapse/client/site/v1/admin-2fa/session");
      expect(localStorage.getItem("base_url")).toBe("https://site.example");
      expect(localStorage.getItem("decoded_base_url")).toBe("https://site.example");
      expect(localStorage.getItem("access_token")).toBe("admin-token");
    });

    it("revokes an unassured token and leaves storage empty", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ user_id: "@admin:site.example", access_token: "unsafe-token", device_id: "device" })
          )
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ assurance: false })))
        .mockResolvedValueOnce(new Response(JSON.stringify({})));

      await expect(
        authProvider.login({
          base_url: "https://site.example",
          username: "@admin:site.example",
          password: "in-memory",
          admin2fa: { challengeId: "challenge-2", deviceId: "device" },
        })
      ).rejects.toBeDefined();

      expect(localStorage.getItem("access_token")).toBeNull();
      expect(localStorage.getItem("base_url")).toBeNull();
      expect(localStorage.getItem("decoded_base_url")).toBeNull();
      expect(localStorage.getItem("user_id")).toBeNull();
      expect(vi.mocked(fetch).mock.calls[2][0]).toBe("https://site.example/_matrix/client/v3/logout");
    });
  });
});
