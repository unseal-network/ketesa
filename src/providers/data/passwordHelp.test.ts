import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../http", () => ({
  jsonClient: vi.fn(),
}));

import { jsonClient } from "../http";
import { getPasswordHelpRequests, updatePasswordHelpRequest } from "./passwordHelp";

const mockedJsonClient = vi.mocked(jsonClient);
const jsonResponse = (json: unknown) => ({ status: 200, headers: new Headers(), body: JSON.stringify(json), json });

describe("password help requests data provider", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("base_url", "http://localhost:18008");
    mockedJsonClient.mockReset();
  });

  it("gets pending requests with pagination", async () => {
    const response = { requests: [], total: 0, from: 50, limit: 25 };
    mockedJsonClient.mockResolvedValue(jsonResponse(response));

    await expect(getPasswordHelpRequests({ from: 50, limit: 25, status: "PENDING" })).resolves.toEqual(response);
    expect(mockedJsonClient).toHaveBeenCalledWith(
      "http://localhost:18008/_synapse/client/site/v1/admin/password-help-requests?from=50&limit=25&status=PENDING"
    );
  });

  it("sends the server request_id when resolving a request", async () => {
    const response = {
      id: "phr_123",
      user_id: "@alice:test",
      status: "RESOLVED",
      first_requested_at: "2026-09-08T00:00:00.000Z",
      last_requested_at: "2026-09-08T00:00:00.000Z",
      request_count: 1,
      resolved_at: "2026-09-08T00:01:00.000Z",
      resolved_by: "@admin:test",
    };
    mockedJsonClient.mockResolvedValue(jsonResponse(response));

    await expect(updatePasswordHelpRequest("phr_123", "RESOLVED")).resolves.toEqual(response);
    expect(mockedJsonClient).toHaveBeenCalledWith(
      "http://localhost:18008/_synapse/client/site/v1/admin/password-help-requests",
      { method: "PUT", body: JSON.stringify({ request_id: "phr_123", status: "RESOLVED" }) }
    );
  });
});
