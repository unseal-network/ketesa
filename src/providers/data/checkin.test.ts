import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("../http", () => ({
  jsonClient: vi.fn(),
}));

import { jsonClient } from "../http";
import { getCheckinRecords, getCheckinSettings, getCheckinUsers, setCheckinSettings } from "./checkin";

const mockedJsonClient = vi.mocked(jsonClient);

const jsonResponse = (json: unknown) => ({
  status: 200,
  headers: new Headers(),
  body: JSON.stringify(json),
  json,
});

describe("checkin settings data provider", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("base_url", "http://localhost:18008");
    mockedJsonClient.mockReset();
  });

  it("gets settings from the site admin endpoint", async () => {
    mockedJsonClient.mockResolvedValue(jsonResponse({ points_per_checkin: 0 }));

    await expect(getCheckinSettings()).resolves.toEqual({ points_per_checkin: 0 });
    expect(mockedJsonClient).toHaveBeenCalledWith(
      "http://localhost:18008/_synapse/client/site/v1/admin/checkin/settings"
    );
  });

  it("puts the exact settings body to the site admin endpoint", async () => {
    mockedJsonClient.mockResolvedValue(jsonResponse({ points_per_checkin: 1_000_000 }));
    const settings = { points_per_checkin: 1_000_000 };

    await expect(setCheckinSettings(settings)).resolves.toEqual(settings);
    expect(mockedJsonClient).toHaveBeenCalledWith(
      "http://localhost:18008/_synapse/client/site/v1/admin/checkin/settings",
      { method: "PUT", body: JSON.stringify(settings) }
    );
  });

  it("gets a paginated user balance list with an encoded search", async () => {
    const response = { users: [], total: 0, from: 50, limit: 25 };
    mockedJsonClient.mockResolvedValue(jsonResponse(response));

    await expect(getCheckinUsers({ from: 50, limit: 25, search: "@alice:test" })).resolves.toEqual(response);
    expect(mockedJsonClient).toHaveBeenCalledWith(
      "http://localhost:18008/_synapse/client/site/v1/admin/checkin/users?from=50&limit=25&search=%40alice%3Atest"
    );
  });

  it("gets filtered check-in records", async () => {
    const response = { records: [], total: 0, from: 0, limit: 50 };
    mockedJsonClient.mockResolvedValue(jsonResponse(response));

    await expect(
      getCheckinRecords({
        from: 0,
        limit: 50,
        search: "alice",
        from_date: "2026-09-01",
        to_date: "2026-09-30",
      })
    ).resolves.toEqual(response);
    expect(mockedJsonClient).toHaveBeenCalledWith(
      "http://localhost:18008/_synapse/client/site/v1/admin/checkin/records?from=0&limit=50&search=alice&from_date=2026-09-01&to_date=2026-09-30"
    );
  });
});
