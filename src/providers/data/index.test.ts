vi.mock("../matrix", async () => ({
  ...(await vi.importActual("../matrix")),
  refreshAccessToken: vi.fn().mockResolvedValue(undefined),
}));

import dataProvider from "./index";
import { clearSystemUsersScanCache, clearReverseSearchScanCache, initResources } from "./index";
import { LoadConfig } from "../../utils/config";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("base_url", "http://localhost");
  localStorage.setItem("access_token", "access_token");
  clearSystemUsersScanCache();
  clearReverseSearchScanCache();
  LoadConfig({
    restrictBaseUrl: "",
    corsCredentials: "same-origin",
    asManagedUsers: [],
    menu: [],
    etkeccAdmin: "",
  });
});

describe("dataProvider", () => {
  it("fetches all users", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          users: [
            {
              name: "@user_id1:provider",
              password_hash: "password_hash1",
              is_guest: 0,
              admin: 0,
              user_type: null,
              deactivated: 0,
              displayname: "User One",
            },
            {
              name: "@user_id2:provider",
              password_hash: "password_hash2",
              is_guest: 0,
              admin: 1,
              user_type: null,
              deactivated: 0,
              displayname: "User Two",
            },
          ],
          next_token: "100",
          total: 200,
        })
      )
    );

    const users = await dataProvider.getList("users", {
      pagination: { page: 1, perPage: 5 },
      sort: { field: "title", order: "ASC" },
      filter: { author_id: 12 },
    });

    expect(users.data[0].id).toEqual("@user_id1:provider");
    expect(users.total).toEqual(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fetches one user", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "@user_id1:provider",
          password: "user_password",
          displayname: "User",
          threepids: [
            {
              medium: "email",
              address: "user@mail_1.com",
            },
            {
              medium: "email",
              address: "user@mail_2.com",
            },
          ],
          avatar_url: "mxc://localhost/user1",
          admin: false,
          deactivated: false,
          creation_ts: 1560432506,
        })
      )
    );

    const user = await dataProvider.getOne("users", { id: "@user_id1:provider" });

    expect(user.data.id).toEqual("@user_id1:provider");
    expect(user.data.displayname).toEqual("User");
    expect(user.data.creation_ts_ms).toEqual(1560432506000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("manages Synapse registration tokens through the native resource API", async () => {
    // A previous MAS test can leave the module-level resource map on its MAS
    // variant, so explicitly restore the Synapse resource for this contract test.
    initResources();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            registration_tokens: [
              { token: "unlimited", uses_allowed: null, pending: 2, completed: 3, expiry_time: null },
              { token: "disabled", uses_allowed: 0, pending: 1, completed: 4, expiry_time: null },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ token: "unlimited", uses_allowed: null, pending: 2, completed: 3, expiry_time: null })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ token: "generated", uses_allowed: null, pending: 0, completed: 0, expiry_time: null })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ token: "unlimited", uses_allowed: null, pending: 2, completed: 3, expiry_time: null })
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({})));

    const listed = await dataProvider.getList("registration_tokens", {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "token", order: "ASC" },
      filter: { valid: false },
    });
    const listURL = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(listURL).toContain("/_synapse/admin/v1/registration_tokens");
    expect(listURL).toContain("valid=false");
    expect(listed.data).toEqual([
      {
        id: "unlimited",
        token: "unlimited",
        uses_allowed: null,
        pending: 2,
        completed: 3,
        expiry_time: null,
      },
      { id: "disabled", token: "disabled", uses_allowed: 0, pending: 1, completed: 4, expiry_time: null },
    ]);
    expect(listed.total).toBe(2);

    const one = await dataProvider.getOne("registration_tokens", { id: "unlimited" });
    expect(one.data.id).toBe("unlimited");
    expect(one.data.pending).toBe(2);
    expect(one.data.completed).toBe(3);

    await dataProvider.create("registration_tokens", {
      data: { token: "", length: "", uses_allowed: null, expiry_time: null },
    });
    const createBody = JSON.parse((vi.mocked(fetch).mock.calls[2]?.[1] as RequestInit).body as string);
    expect(createBody).toEqual({ uses_allowed: null, expiry_time: null });

    await dataProvider.update("registration_tokens", {
      id: "unlimited",
      previousData: { token: "unlimited", uses_allowed: 5, expiry_time: Date.now() + 60_000 },
      data: { token: "unlimited", pending: 2, completed: 3, uses_allowed: null, expiry_time: null },
    });
    const updateRequest = vi.mocked(fetch).mock.calls[3];
    expect(updateRequest?.[0]).toContain("/_synapse/admin/v1/registration_tokens/unlimited");
    expect(JSON.parse((updateRequest?.[1] as RequestInit).body as string)).toEqual({
      uses_allowed: null,
      expiry_time: null,
    });

    await dataProvider.delete("registration_tokens", {
      id: "unlimited",
      previousData: { id: "unlimited", token: "unlimited" },
    });
    expect(vi.mocked(fetch).mock.calls[4]?.[0]).toContain("/_synapse/admin/v1/registration_tokens/unlimited");
    expect((vi.mocked(fetch).mock.calls[4]?.[1] as RequestInit).method).toBe("DELETE");
  });

  it("keeps Synapse list creation_ts values in milliseconds", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          users: [
            {
              name: "@user_id1:provider",
              is_guest: 0,
              admin: 0,
              user_type: null,
              deactivated: 0,
              displayname: "User One",
              creation_ts: 1560432668000,
            },
          ],
          total: 1,
        })
      )
    );

    const users = await dataProvider.getList("users", {
      pagination: { page: 1, perPage: 5 },
      sort: { field: "name", order: "ASC" },
      filter: {},
    });

    expect(users.data[0].creation_ts_ms).toEqual(1560432668000);
  });

  it("skips MAS availability check when no access token", async () => {
    localStorage.setItem("token_endpoint", "http://mas.example/oauth2/token");
    localStorage.removeItem("access_token");

    // isMAS() reads RaStore.isMAS, which is not set, so registration_tokens stays Synapse
    const { initResources } = await import("./index");
    initResources();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses MAS pagination cursor on page 2", async () => {
    vi.resetModules();
    // Re-import after reset so MAS registration tokens init isn't cached from prior tests.
    const { default: freshDataProvider } = await import("./index");

    localStorage.setItem("token_endpoint", "http://mas.example/oauth2/token");
    // Set the cached MAS flag so the resource is detected as MAS
    localStorage.setItem("RaStore.isMAS", "true");

    // Re-init registration tokens with the MAS flag set
    const { initResources } = await import("./index");
    initResources();

    const masListPage1 = {
      links: {
        self: "/api/admin/v1/user-registration-tokens?page%5Bafter%5D=01JB4PAPAMESEFX6CNP1JA5M6V&page%5Bfirst%5D=10",
        first: "/api/admin/v1/user-registration-tokens?page%5Bfirst%5D=10",
        last: "/api/admin/v1/user-registration-tokens?page%5Bafter%5D=01JB4PAPG3N9FS0YVQTMYV0NG&page%5Bfirst%5D=10",
        next: "/api/admin/v1/user-registration-tokens?page%5Bafter%5D=01JB4PAPAMESEFX6CNP1JA5M6V&page%5Bfirst%5D=10",
        prev: null,
      },
      data: [
        {
          type: "user-registration-token",
          id: "01JB4PAPAMESEFX6CNP1JA5M6V",
          attributes: {
            token: "5lQl96lyEJwMRx1c1Vx0Q2O93",
            valid: true,
            usage_limit: null,
            times_used: 0,
            created_at: "2024-06-10T10:12:21.184Z",
            last_used_at: null,
            expires_at: null,
            revoked_at: null,
          },
        },
      ],
      meta: {
        count: 1,
      },
    };

    const masListPage2 = {
      links: {
        self: "/api/admin/v1/user-registration-tokens?page%5Bafter%5D=01JB4PAPG3N9FS0YVQTMYV0NG&page%5Bfirst%5D=10",
        first: "/api/admin/v1/user-registration-tokens?page%5Bfirst%5D=10",
        last: "/api/admin/v1/user-registration-tokens?page%5Bafter%5D=01JB4PAPG3N9FS0YVQTMYV0NG&page%5Bfirst%5D=10",
        next: null,
        prev: "/api/admin/v1/user-registration-tokens?page%5Bbefore%5D=01JB4PAPG3N9FS0YVQTMYV0NG&page%5Bfirst%5D=10",
      },
      data: [],
      meta: {
        count: 1,
      },
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(masListPage1)))
      .mockResolvedValueOnce(new Response(JSON.stringify(masListPage2)));

    await freshDataProvider.getList("registration_tokens", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "token", order: "ASC" },
      filter: { valid: true },
    });

    await freshDataProvider.getList("registration_tokens", {
      pagination: { page: 2, perPage: 10 },
      sort: { field: "token", order: "ASC" },
      filter: { valid: true },
    });

    const [page2Url] = vi.mocked(fetch).mock.calls[1];
    expect(page2Url).toContain("http://mas.example/api/admin/v1/user-registration-tokens?");
    expect(page2Url).toContain("page%5Bfirst%5D=10");
    expect(page2Url).toContain("page%5Bafter%5D=01JB4PAPAMESEFX6CNP1JA5M6V");
    expect(page2Url).toContain("filter%5Bvalid%5D=true");
  });

  it("keeps fetching backend pages until a filtered users page is filled", async () => {
    LoadConfig({
      restrictBaseUrl: "",
      corsCredentials: "same-origin",
      asManagedUsers: ["^@sys"],
      menu: [],
      etkeccAdmin: "",
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          users: [
            { name: "@sys1:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "System 1" },
            { name: "@sys2:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "System 2" },
            { name: "@user1:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "User 1" },
            { name: "@sys3:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "System 3" },
            { name: "@user2:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "User 2" },
          ],
          total: 5,
        })
      )
    );

    const users = await dataProvider.getList("users", {
      pagination: { page: 1, perPage: 2 },
      sort: { field: "name", order: "ASC" },
      filter: { system_users: false, deactivated: false },
    });

    expect(users.data.map(user => user.id)).toEqual(["@user1:provider", "@user2:provider"]);
    expect(users.total).toEqual(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("from=0");
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("limit=250");
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("deactivated=false");
  });

  it("paginates users by the filtered system_users dataset", async () => {
    LoadConfig({
      restrictBaseUrl: "",
      corsCredentials: "same-origin",
      asManagedUsers: ["^@sys"],
      menu: [],
      etkeccAdmin: "",
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          users: [
            { name: "@sys1:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "System 1" },
            { name: "@user1:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "User 1" },
            { name: "@sys2:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "System 2" },
            { name: "@user2:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "User 2" },
            { name: "@user3:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "User 3" },
            { name: "@sys3:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "System 3" },
          ],
          total: 6,
        })
      )
    );

    const users = await dataProvider.getList("users", {
      pagination: { page: 2, perPage: 2 },
      sort: { field: "name", order: "ASC" },
      filter: { system_users: false, guests: false },
    });

    expect(users.data.map(user => user.id)).toEqual(["@user3:provider"]);
    expect(users.total).toEqual(3);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("from=0");
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("limit=250");
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("guests=false");
  });

  it("stops once the filtered page is filled and reports partial pagination info", async () => {
    LoadConfig({
      restrictBaseUrl: "",
      corsCredentials: "same-origin",
      asManagedUsers: ["^@sys"],
      menu: [],
      etkeccAdmin: "",
    });

    const firstChunkUsers = [
      { name: "@sys1:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "System 1" },
      { name: "@user1:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "User 1" },
      { name: "@sys2:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "System 2" },
      { name: "@user2:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "User 2" },
      { name: "@user3:provider", is_guest: 0, admin: 0, deactivated: 0, displayname: "User 3" },
      ...Array.from({ length: 245 }, (_, index) => ({
        name: `@sys_more${index}:provider`,
        is_guest: 0,
        admin: 0,
        deactivated: 0,
        displayname: `System More ${index}`,
      })),
    ];

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          users: firstChunkUsers,
          total: 300,
        })
      )
    );

    const users = await dataProvider.getList("users", {
      pagination: { page: 1, perPage: 2 },
      sort: { field: "name", order: "ASC" },
      filter: { system_users: false },
    });

    expect(users.data.map(user => user.id)).toEqual(["@user1:provider", "@user2:provider"]);
    expect(users.total).toBeUndefined();
    expect(users.pageInfo).toEqual({
      hasPreviousPage: false,
      hasNextPage: true,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reuses cached filtered scan state across later pages", async () => {
    LoadConfig({
      restrictBaseUrl: "",
      corsCredentials: "same-origin",
      asManagedUsers: ["^@sys"],
      menu: [],
      etkeccAdmin: "",
    });

    const firstChunkUsers = Array.from({ length: 250 }, (_, index) => ({
      name: index < 80 ? `@user${index}:provider` : `@sys${index}:provider`,
      is_guest: 0,
      admin: 0,
      deactivated: 0,
      displayname: `User ${index}`,
    }));
    const secondChunkUsers = Array.from({ length: 50 }, (_, index) => ({
      name: `@user_more${index}:provider`,
      is_guest: 0,
      admin: 0,
      deactivated: 0,
      displayname: `More User ${index}`,
    }));

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            users: firstChunkUsers,
            total: 300,
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            users: secondChunkUsers,
            total: 300,
          })
        )
      );

    const page1 = await dataProvider.getList("users", {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "name", order: "ASC" },
      filter: { system_users: false },
    });

    const page2 = await dataProvider.getList("users", {
      pagination: { page: 2, perPage: 50 },
      sort: { field: "name", order: "ASC" },
      filter: { system_users: false },
    });

    expect(page1.data).toHaveLength(50);
    expect(page2.data).toHaveLength(50);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("from=0");
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toContain("from=250");
  });

  it("update skips the profile PUT when the user was erased (meta.userErased)", async () => {
    const result = await dataProvider.update("users", {
      id: "@bob:hs",
      previousData: { id: "@bob:hs", deactivated: false, erased: false },
      data: { id: "@bob:hs", deactivated: false, erased: false, displayname: "x" },
      meta: { userErased: true },
    });

    // No HTTP request fired; the erased account would have returned M_UNKNOWN.
    expect(fetch).not.toHaveBeenCalled();
    expect(result.data.id).toBe("@bob:hs");
    expect(result.data.deactivated).toBe(true);
    expect(result.data.erased).toBe(true);
  });

  it("createMany sends one notice per recipient with no cross-contamination", async () => {
    // Guards the wrong-recipient hazard: createMany builds a fresh payload per id and
    // must never bleed one recipient's id into another's request.
    // Fresh Response per call: a single Response body can only be read once.
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ event_id: "$evt" }))));

    const ids = ["@alice:localhost", "@bob:localhost", "@carol:localhost"];
    await dataProvider.createMany("servernotices", { ids, data: { body: "maintenance tonight" } });

    expect(fetch).toHaveBeenCalledTimes(ids.length);

    const sentUserIds = vi.mocked(fetch).mock.calls.map(call => {
      const opts = call[1] as { body: string };
      const body = JSON.parse(opts.body);
      // Every recipient gets the same message body, addressed to themselves only.
      expect(body.content).toEqual({ msgtype: "m.text", body: "maintenance tonight" });
      return body.user_id as string;
    });

    expect([...sentUserIds].sort()).toEqual([...ids].sort());
    expect(new Set(sentUserIds).size).toBe(ids.length);
  });

  it("threads both user_reports filters into the list query", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user_reports: [
            {
              id: 1,
              received_ts: 1560432668000,
              user_id: "@reporter:provider",
              target_user_id: "@bad:provider",
              reason: "spam",
            },
          ],
          total: 1,
        })
      )
    );

    const reports = await dataProvider.getList("user_reports", {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "received_ts", order: "DESC" },
      filter: { user_id: "reporter", target_user_id: "spammer" },
    });

    expect(reports.data[0].id).toEqual(1);
    expect(reports.total).toEqual(1);
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("/_synapse/admin/v1/user_reports");
    expect(url).toContain("user_id=reporter");
    expect(url).toContain("target_user_id=spammer");
  });

  it("does not leak target_user_id into sibling resource queries", async () => {
    // Regression guard: buildSynapseListQuery emits target_user_id for every resource,
    // so an undefined value must be dropped before the URL — never sent as a stray param.
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ event_reports: [], total: 0 })));

    await dataProvider.getList("reports", {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "received_ts", order: "DESC" },
      filter: {},
    });

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).not.toContain("target_user_id");
  });
});
