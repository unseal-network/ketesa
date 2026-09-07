import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import polyglotI18nProvider from "ra-i18n-polyglot";
import { AdminContext } from "react-admin";
import { beforeEach, describe, expect, it, vi } from "vitest";

import englishMessages from "../i18n/en";
import AccountSecurityPage from "./AccountSecurityPage";

const i18nProvider = polyglotI18nProvider(() => englishMessages, "en", [{ locale: "en", name: "English" }]);

const renderPage = () =>
  render(
    <AdminContext i18nProvider={i18nProvider}>
      <AccountSecurityPage />
    </AdminContext>
  );

describe("AccountSecurityPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("base_url", "https://logged-in.example");
    localStorage.setItem("access_token", "token");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads factors through the logged-in base URL and prevents deleting the last factor", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ factors: [{ id: "factor-1", name: "Work phone" }] }))
    );
    renderPage();

    expect(await screen.findByText("Work phone")).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "https://logged-in.example/_synapse/client/site/v1/admin-2fa/factors"
    );
    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /delete/i })).toHaveAttribute(
      "title",
      "At least one authenticator must remain."
    );
  });

  it("confirms a newly scanned factor with a six digit code", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ factors: [{ id: "factor-1", name: "Primary" }] })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ factor: { id: "factor-2", name: "Backup", otpauth_uri: "otpauth://totp/x" } }))
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({})))
      .mockResolvedValueOnce(new Response(JSON.stringify({ factors: [{ id: "factor-1" }, { id: "factor-2" }] })));
    renderPage();

    await screen.findByText("Primary");
    await user.click(screen.getByRole("button", { name: /add authenticator/i }));
    const code = await screen.findByLabelText(/authenticator code/i);
    await user.type(code, "123456");
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(vi.mocked(fetch).mock.calls[2][0]).toContain("/factors/factor-2");
    expect(JSON.parse(String((vi.mocked(fetch).mock.calls[2][1] as RequestInit).body))).toEqual({ code: "123456" });
  });

  it("requires a current code from a remaining factor before deleting", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            factors: [
              { id: "factor-1", name: "Primary" },
              { id: "factor-2", name: "Backup" },
            ],
          })
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ factors: [{ id: "factor-2", name: "Backup" }] })));
    renderPage();

    await screen.findByText("Primary");
    await user.click(screen.getAllByRole("button", { name: /delete/i })[0]);
    await user.type(await screen.findByLabelText(/authenticator code/i), "654321");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain("/factors/factor-1");
    expect(JSON.parse(String((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body))).toEqual({ code: "654321" });
  });
});
