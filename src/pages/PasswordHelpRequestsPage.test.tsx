import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import polyglotI18nProvider from "ra-i18n-polyglot";
import { AdminContext } from "react-admin";
import { MemoryRouter, useLocation } from "react-router-dom";

import englishMessages from "../i18n/en";
import PasswordHelpRequestsPage, { PasswordHelpRequestsBadge } from "./PasswordHelpRequestsPage";

vi.mock("../components/hooks/useDocTitle", () => ({ useDocTitle: vi.fn() }));

const i18nProvider = polyglotI18nProvider(() => englishMessages, "en", [{ locale: "en", name: "English" }]);

const makeMockDataProvider = (overrides: Record<string, unknown> = {}) => ({
  getList: vi.fn(),
  getOne: vi.fn(),
  getMany: vi.fn(),
  getManyReference: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  getPasswordHelpRequests: vi.fn(),
  updatePasswordHelpRequest: vi.fn(),
  ...overrides,
});

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

const renderPage = (dataProvider: ReturnType<typeof makeMockDataProvider>) =>
  render(
    <MemoryRouter>
      <AdminContext i18nProvider={i18nProvider} dataProvider={dataProvider}>
        <PasswordHelpRequestsPage />
        <LocationProbe />
      </AdminContext>
    </MemoryRouter>
  );

describe("PasswordHelpRequestsPage", () => {
  it("lists pending requests and marks one resolved", async () => {
    const user = userEvent.setup();
    const request = {
      id: "phr_123",
      user_id: "@alice:test",
      status: "PENDING" as const,
      first_requested_at: "2026-09-07T00:00:00.000Z",
      last_requested_at: "2026-09-08T00:00:00.000Z",
      request_count: 3,
      resolved_at: null,
      resolved_by: null,
    };
    const getPasswordHelpRequests = vi
      .fn()
      .mockResolvedValueOnce({ requests: [request], total: 1, from: 0, limit: 50 })
      .mockResolvedValueOnce({ requests: [], total: 0, from: 0, limit: 50 });
    const updatePasswordHelpRequest = vi.fn().mockResolvedValue({ ...request, status: "RESOLVED" });
    const dataProvider = makeMockDataProvider({ getPasswordHelpRequests, updatePasswordHelpRequest });

    await act(async () => {
      renderPage(dataProvider);
    });

    expect(await screen.findByText("@alice:test")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark resolved" }));

    await waitFor(() => expect(updatePasswordHelpRequest).toHaveBeenCalledWith("phr_123", "RESOLVED"));
    expect(getPasswordHelpRequests).toHaveBeenLastCalledWith({ from: 0, limit: 50, status: "PENDING" });
  });

  it("requests a different page with the selected status", async () => {
    const user = userEvent.setup();
    const dataProvider = makeMockDataProvider({
      getPasswordHelpRequests: vi.fn().mockResolvedValue({ requests: [], total: 0, from: 0, limit: 50 }),
    });
    await act(async () => {
      renderPage(dataProvider);
    });

    await user.click(await screen.findByRole("tab", { name: "Resolved" }));
    await waitFor(() =>
      expect(dataProvider.getPasswordHelpRequests).toHaveBeenLastCalledWith({ from: 0, limit: 50, status: "RESOLVED" })
    );
  });

  it("opens the selected user", async () => {
    const user = userEvent.setup();
    const dataProvider = makeMockDataProvider({
      getPasswordHelpRequests: vi.fn().mockResolvedValue({
        requests: [
          {
            id: "phr_123",
            user_id: "@alice:test",
            status: "PENDING",
            first_requested_at: "2026-09-07T00:00:00.000Z",
            last_requested_at: "2026-09-08T00:00:00.000Z",
            request_count: 1,
            resolved_at: null,
            resolved_by: null,
          },
        ],
        total: 1,
        from: 0,
        limit: 50,
      }),
    });
    await act(async () => renderPage(dataProvider));

    await user.click(await screen.findByRole("button", { name: "Open user" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/users/%40alice%3Atest");
  });

  it("shows the pending request count in the navigation badge", async () => {
    const dataProvider = makeMockDataProvider({
      getPasswordHelpRequests: vi.fn().mockResolvedValue({ requests: [], total: 4, from: 0, limit: 1 }),
    });

    render(
      <MemoryRouter>
        <AdminContext i18nProvider={i18nProvider} dataProvider={dataProvider}>
          <PasswordHelpRequestsBadge />
        </AdminContext>
      </MemoryRouter>
    );

    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(dataProvider.getPasswordHelpRequests).toHaveBeenCalledWith({ from: 0, limit: 1, status: "PENDING" });
  });
});
