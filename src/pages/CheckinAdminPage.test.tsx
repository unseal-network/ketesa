import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import polyglotI18nProvider from "ra-i18n-polyglot";
import { AdminContext } from "react-admin";

import englishMessages from "../i18n/en";
import CheckinAdminPage from "./CheckinAdminPage";

vi.mock("../components/hooks/useDocTitle", () => ({
  useDocTitle: vi.fn(),
}));

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
  getCheckinUsers: vi.fn(),
  getCheckinRecords: vi.fn(),
  ...overrides,
});

describe("CheckinAdminPage", () => {
  it("shows user balances and drills into that user's immutable records", async () => {
    const user = userEvent.setup();
    const getCheckinRecords = vi.fn().mockResolvedValue({
      records: [
        {
          user_id: "@alice:test",
          date: "2026-09-05",
          points: 7,
          awarded_at: "2026-09-05T00:00:00.000Z",
        },
      ],
      total: 1,
      from: 0,
      limit: 50,
    });
    const dataProvider = makeMockDataProvider({
      getCheckinUsers: vi.fn().mockResolvedValue({
        users: [
          {
            user_id: "@alice:test",
            total_points: 12,
            checkin_count: 2,
            current_streak: 2,
            longest_streak: 4,
            last_checkin: "2026-09-05",
          },
        ],
        total: 1,
        from: 0,
        limit: 50,
      }),
      getCheckinRecords,
    });

    await act(async () => {
      render(
        <AdminContext i18nProvider={i18nProvider} dataProvider={dataProvider}>
          <CheckinAdminPage />
        </AdminContext>
      );
    });

    expect(await screen.findByText("@alice:test")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View records" }));

    await waitFor(() => expect(getCheckinRecords).toHaveBeenCalledWith({ from: 0, limit: 50, search: "@alice:test" }));
    expect(await screen.findByText("+7")).toBeInTheDocument();
  });
});
