import { HttpError } from "react-admin";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../http", () => ({
  jsonClient: vi.fn(),
}));

import { jsonClient } from "../http";
import { getUserPhone } from "./userPhone";

const mockedJsonClient = vi.mocked(jsonClient);
const jsonResponse = (json: unknown) => ({ status: 200, headers: new Headers(), body: JSON.stringify(json), json });

describe("user phone data provider", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("base_url", "http://localhost:18008");
    mockedJsonClient.mockReset();
  });

  it("requests the phone remark with an encoded user id", async () => {
    const response = { user_id: "@alice+1:test", phone: "+86 138 0000 0000", updated_at_ms: 1_758_000_000_000 };
    mockedJsonClient.mockResolvedValue(jsonResponse(response));

    await expect(getUserPhone("@alice+1:test")).resolves.toEqual(response);
    expect(mockedJsonClient).toHaveBeenCalledWith(
      "http://localhost:18008/_synapse/client/site/v1/admin/users/phone?user_id=%40alice%2B1%3Atest"
    );
  });

  it("returns a null phone as provided by the server", async () => {
    const response = { user_id: "@bob:test", phone: null, updated_at_ms: null };
    mockedJsonClient.mockResolvedValue(jsonResponse(response));

    await expect(getUserPhone("@bob:test")).resolves.toEqual(response);
  });

  it("resolves to null when the server does not provide the endpoint", async () => {
    mockedJsonClient.mockRejectedValue(new HttpError("Not found", 404, {}));

    await expect(getUserPhone("@bob:test")).resolves.toBeNull();
  });

  it("propagates other errors such as a forbidden non-admin request", async () => {
    const error = new HttpError("Forbidden", 403, {});
    mockedJsonClient.mockRejectedValue(error);

    await expect(getUserPhone("@bob:test")).rejects.toBe(error);
  });

  it("fails when no homeserver is configured", async () => {
    localStorage.clear();

    await expect(getUserPhone("@bob:test")).rejects.toThrow("Homeserver not set");
    expect(mockedJsonClient).not.toHaveBeenCalled();
  });
});
