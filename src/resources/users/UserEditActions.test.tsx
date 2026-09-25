import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminContext, DataProvider, Notification, RecordContextProvider } from "react-admin";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "../../i18n/en";

let masMode = false;
vi.mock("../../providers/data/mas", async () => {
  const actual = await vi.importActual<typeof import("../../providers/data/mas")>("../../providers/data/mas");
  return { ...actual, useIsMAS: () => masMode };
});

import { UserEditActions } from "./index";

const i18nProvider = polyglotI18nProvider(() => englishMessages, "en");
const dataProvider = {
  getList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getOne: vi.fn(),
  getMany: vi.fn(),
  getManyReference: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  resetPassword: vi.fn().mockResolvedValue({ success: true }),
} as unknown as DataProvider;

const actionsForRecord = (record: { id: string; deactivated: boolean }) => (
  <AdminContext i18nProvider={i18nProvider} dataProvider={dataProvider}>
    <RecordContextProvider value={record}>
      <>
        <UserEditActions />
        <Notification />
      </>
    </RecordContextProvider>
  </AdminContext>
);

const renderActions = () => render(actionsForRecord({ id: "@alice:example.org", deactivated: false }));

describe("UserEditActions", () => {
  beforeEach(() => {
    masMode = false;
    localStorage.clear();
    vi.clearAllMocks();
    dataProvider.resetPassword.mockReset().mockResolvedValue({ success: true });
  });

  it("exposes the bounded password reset flow while keeping impersonation hidden", async () => {
    const user = userEvent.setup();
    renderActions();
    expect(screen.getByRole("button", { name: /allow cross-signing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /renew account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send server notices/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/log out all of their existing devices/i)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/New password/), "new secret");
    await user.type(within(dialog).getByLabelText(/Confirm new password/), "new secret");
    await user.type(within(dialog).getByLabelText(/Confirm target user/), "@alice:example.org");
    expect(within(dialog).getByRole("button", { name: /confirm/i })).toBeEnabled();
    await user.click(within(dialog).getByRole("button", { name: /confirm/i }));
    expect(dataProvider.resetPassword).toHaveBeenCalledWith("@alice:example.org", "new secret", true);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /login as|impersonate/i })).not.toBeInTheDocument();
  });

  it("requires matching passwords and the exact target user ID", async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: /confirm/i });

    await user.type(within(dialog).getByLabelText(/New password/), "new secret");
    await user.type(within(dialog).getByLabelText(/Confirm new password/), "different secret");
    await user.type(within(dialog).getByLabelText(/Confirm target user/), "@alice:example.org");
    expect(within(dialog).getByText("Passwords do not match")).toBeInTheDocument();
    expect(confirm).toBeDisabled();

    const confirmPassword = within(dialog).getByLabelText(/Confirm new password/);
    await user.clear(confirmPassword);
    await user.type(confirmPassword, "new secret");
    const targetUser = within(dialog).getByLabelText(/Confirm target user/);
    await user.clear(targetUser);
    await user.type(targetUser, "@bob:example.org");
    expect(within(dialog).getByText("Type the target user ID exactly to confirm")).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    expect(dataProvider.resetPassword).not.toHaveBeenCalled();
  });

  it("shows the server error and re-enables retry after a failed reset", async () => {
    const user = userEvent.setup();
    dataProvider.resetPassword.mockResolvedValue({ success: false, error: "Password is too weak" });
    renderActions();
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(/New password/), "weak");
    await user.type(within(dialog).getByLabelText(/Confirm new password/), "weak");
    await user.type(within(dialog).getByLabelText(/Confirm target user/), "@alice:example.org");
    await user.click(within(dialog).getByRole("button", { name: /confirm/i }));

    expect(await screen.findByText("Password is too weak")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /confirm/i })).toBeEnabled();
    expect(dialog).toBeInTheDocument();

    dataProvider.resetPassword.mockRejectedValueOnce(new Error("connection lost"));
    await user.click(within(dialog).getByRole("button", { name: /confirm/i }));
    expect(await screen.findByText("Failed to reset password")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /confirm/i })).toBeEnabled();
  });

  it("locks the form while the password reset request is pending", async () => {
    const user = userEvent.setup();
    let finishReset: ((result: { success: boolean }) => void) | undefined;
    dataProvider.resetPassword.mockImplementation(
      () => new Promise(resolve => (finishReset = resolve)) as ReturnType<typeof dataProvider.resetPassword>
    );
    renderActions();
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(/New password/), "new secret");
    await user.type(within(dialog).getByLabelText(/Confirm new password/), "new secret");
    await user.type(within(dialog).getByLabelText(/Confirm target user/), "@alice:example.org");
    await user.click(within(dialog).getByRole("button", { name: /confirm/i }));

    expect(within(dialog).getByRole("button", { name: /resetting password/i })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(within(dialog).getByLabelText(/New password/)).toBeDisabled();

    await act(async () => finishReset?.({ success: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("ignores a pending result after switching to another user", async () => {
    const user = userEvent.setup();
    let finishReset: ((result: { success: boolean }) => void) | undefined;
    dataProvider.resetPassword.mockImplementation(
      () => new Promise(resolve => (finishReset = resolve)) as ReturnType<typeof dataProvider.resetPassword>
    );
    const view = renderActions();
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(/New password/), "new secret");
    await user.type(within(dialog).getByLabelText(/Confirm new password/), "new secret");
    await user.type(within(dialog).getByLabelText(/Confirm target user/), "@alice:example.org");
    await user.click(within(dialog).getByRole("button", { name: /confirm/i }));

    view.rerender(actionsForRecord({ id: "@bob:example.org", deactivated: false }));
    expect(within(dialog).getByText(/Type @bob:example.org exactly to confirm this account/)).toBeInTheDocument();
    await act(async () => finishReset?.({ success: true }));

    expect(screen.queryByText("Password was reset successfully")).not.toBeInTheDocument();
  });

  it("shows MAS-safe notices without exposing the Synapse-only reset action", () => {
    masMode = true;
    renderActions();
    expect(screen.getByRole("button", { name: /send server notices/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset password|login as|impersonate/i })).not.toBeInTheDocument();
  });
});
