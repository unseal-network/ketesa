import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminContext, DataProvider, Form, HttpError, RecordContextProvider } from "react-admin";
import polyglotI18nProvider from "ra-i18n-polyglot";

import englishMessages from "../../i18n/en";
import UserPhoneRemark from "./UserPhoneRemark";

const i18nProvider = polyglotI18nProvider(() => englishMessages, "en");
const getUserPhone = vi.fn();
const dataProvider = {
  getList: vi.fn(),
  getOne: vi.fn(),
  getMany: vi.fn(),
  getManyReference: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  getUserPhone,
} as unknown as DataProvider;

const record = { id: "@alice:example.org", displayname: "Alice" };

const renderRemark = (onSubmit = vi.fn()) =>
  render(
    <AdminContext i18nProvider={i18nProvider} dataProvider={dataProvider}>
      <RecordContextProvider value={record}>
        <Form onSubmit={onSubmit}>
          <UserPhoneRemark />
          <button type="submit">Save</button>
        </Form>
      </RecordContextProvider>
    </AdminContext>
  );

describe("UserPhoneRemark", () => {
  beforeEach(() => {
    getUserPhone.mockReset();
  });

  it("shows the phone remark and when it was updated", async () => {
    getUserPhone.mockResolvedValue({
      user_id: record.id,
      phone: "+86 138 0000 0000",
      updated_at_ms: Date.UTC(2026, 8, 1),
    });
    renderRemark();

    expect(screen.getByText("Phone (remark)")).toBeInTheDocument();
    expect(await screen.findByText("+86 138 0000 0000")).toBeInTheDocument();
    expect(screen.getByText(/^Updated /)).toBeInTheDocument();
    expect(getUserPhone).toHaveBeenCalledWith("@alice:example.org");
  });

  it("shows a muted placeholder when the user did not provide a phone", async () => {
    getUserPhone.mockResolvedValue({ user_id: record.id, phone: null, updated_at_ms: null });
    renderRemark();

    expect(await screen.findByText("Not provided")).toBeInTheDocument();
    expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();
  });

  it("shows a hint when the server does not provide the endpoint", async () => {
    // The data provider maps a 404 from older servers to null.
    getUserPhone.mockResolvedValue(null);
    renderRemark();

    expect(await screen.findByText("Not available on this server")).toBeInTheDocument();
  });

  it("shows a load error for other failures", async () => {
    getUserPhone.mockRejectedValue(new HttpError("Forbidden", 403, {}));
    renderRemark();

    expect(await screen.findByText("Could not load phone number")).toBeInTheDocument();
    expect(getUserPhone).toHaveBeenCalledTimes(1);
  });

  it("is never part of the submitted form values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    getUserPhone.mockResolvedValue({ user_id: record.id, phone: "+1 555 0100", updated_at_ms: null });
    renderRemark(onSubmit);

    await screen.findByText("+1 555 0100");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const submitted = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(submitted).not.toHaveProperty("phone");
    expect(JSON.stringify(submitted)).not.toContain("+1 555 0100");
  });
});
