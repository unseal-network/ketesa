import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import polyglotI18nProvider from "ra-i18n-polyglot";
import { AdminContext } from "react-admin";
import { beforeEach, describe, expect, it, vi } from "vitest";

import englishMessages from "../../i18n/en";
import { AppContext } from "../../Context";
import SiteAdminLogin from "./SiteAdminLogin";

const i18nProvider = polyglotI18nProvider(() => englishMessages, "en", [{ locale: "en", name: "English" }]);
const binding = { siteId: "site_test", homeserverUrl: "https://site.example", serverName: "site.example" };

const renderPage = (login = vi.fn().mockResolvedValue({ redirectTo: "/" })) =>
  render(
    <AppContext.Provider
      value={{
        restrictBaseUrl: binding.homeserverUrl,
        corsCredentials: "same-origin",
        menu: [],
        asManagedUsers: [],
        siteBinding: binding,
      }}
    >
      <AdminContext i18nProvider={i18nProvider} authProvider={{ login } as never}>
        <SiteAdminLogin siteBinding={binding} welcomeTo="Site Admin" />
      </AdminContext>
    </AppContext.Provider>
  );

describe("SiteAdminLogin", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows enrollment QR and hides the password after password verification", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ challenge_id: "c1", flow: "ENROLL" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "io.auto_release.admin_2fa": {
              challenge_id: "c1",
              flow: "ENROLL",
              otpauth_uri: "otpauth://totp/Site:admin?secret=MANUALKEY",
            },
          }),
          { status: 403 }
        )
      );
    renderPage();

    await user.type(screen.getByLabelText(/username/i), "@admin:site.example");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    const password = await screen.findByLabelText(/password/i);
    await user.type(password, "password");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText("MANUALKEY")).toBeInTheDocument();
    expect(screen.getByLabelText(/authenticator code/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it("keeps authenticate sign-in disabled until a six digit code is entered", async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ redirectTo: "/" });
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ challenge_id: "c2", flow: "AUTHENTICATE" })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ "io.auto_release.admin_2fa": { challenge_id: "c2" } }), { status: 403 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ verified: true })));
    renderPage(login);

    await user.type(screen.getByLabelText(/username/i), "@admin:site.example");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(await screen.findByLabelText(/password/i), "password");
    const submit = screen.getByRole("button", { name: /verify and sign in/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/authenticator code/i), "12345");
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/authenticator code/i), "6");
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
  });
});
