import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../http", () => ({ jsonClient: vi.fn() }));

import { jsonClient } from "../http";
import { getStatisticsReport } from "./statistics";

const mockedJsonClient = vi.mocked(jsonClient);

describe("statistics report provider", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("base_url", "http://localhost:18008");
    mockedJsonClient.mockReset();
  });

  it("calls only the unified report endpoint with a half-open date range", async () => {
    const response = { from: "2026-09-01", to: "2026-10-01", registrations: { total: 0 } };
    mockedJsonClient.mockResolvedValue({
      status: 200,
      headers: new Headers(),
      body: JSON.stringify(response),
      json: response,
    });

    await expect(getStatisticsReport({ from: "2026-09-01", to: "2026-10-01" })).resolves.toEqual(response);
    expect(mockedJsonClient).toHaveBeenCalledWith(
      "http://localhost:18008/_synapse/client/site/v1/statistics/report?from=2026-09-01&to=2026-10-01"
    );
  });

  it("supports the server-default range without inventing client-side dates", async () => {
    const response = { from: "2026-09-01", to: "2026-10-01" };
    mockedJsonClient.mockResolvedValue({
      status: 200,
      headers: new Headers(),
      body: JSON.stringify(response),
      json: response,
    });

    await expect(getStatisticsReport()).resolves.toEqual(response);
    expect(mockedJsonClient).toHaveBeenCalledWith("http://localhost:18008/_synapse/client/site/v1/statistics/report");
  });
});
