import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  adjustCheckinPoints: vi.fn(),
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

  it("requires confirmation before applying a signed bulk adjustment and shows per-user results", async () => {
    const user = userEvent.setup();
    const adjustCheckinPoints = vi.fn().mockResolvedValue({
      request_id: "request-1",
      amount: -3,
      replayed: false,
      results: [
        { user_id: "@alice:test", previous_points: 8, total_points: 5 },
        { user_id: "@bob:test", previous_points: 3, total_points: 0 },
      ],
    });
    const dataProvider = makeMockDataProvider({
      getCheckinUsers: vi.fn().mockResolvedValue({ users: [], total: 0, from: 0, limit: 50 }),
      getCheckinRecords: vi.fn().mockResolvedValue({ records: [], total: 0, from: 0, limit: 50 }),
      adjustCheckinPoints,
    });

    await act(async () => {
      render(
        <AdminContext i18nProvider={i18nProvider} dataProvider={dataProvider}>
          <CheckinAdminPage />
        </AdminContext>
      );
    });

    await user.type(screen.getByRole("textbox", { name: "Matrix user IDs" }), "@alice:test\n@bob:test");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Signed point adjustment" }), {
      target: { value: "-3" },
    });
    await user.click(screen.getByRole("button", { name: "Review adjustment" }));

    expect(screen.getByRole("dialog", { name: "Confirm point adjustment" })).toBeInTheDocument();
    expect(
      screen.getByText("Apply -3 points to 2 accounts? No account balance can go below zero.")
    ).toBeInTheDocument();
    expect(adjustCheckinPoints).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Apply adjustment" }));

    await waitFor(() => expect(adjustCheckinPoints).toHaveBeenCalledTimes(1));
    expect(adjustCheckinPoints).toHaveBeenCalledWith({
      request_id: expect.any(String),
      user_ids: ["@alice:test", "@bob:test"],
      amount: -3,
    });
    expect(await screen.findByText("Applied -3 points to 2 accounts.")).toBeInTheDocument();
    expect(screen.getByText("@alice:test")).toBeInTheDocument();
    expect(screen.getByText(": 8 → 5")).toBeInTheDocument();
    expect(screen.getByText(": 3 → 0")).toBeInTheDocument();
  });

  it("shows adjustment errors and reuses the request ID when the same batch is retried", async () => {
    const user = userEvent.setup();
    const adjustCheckinPoints = vi.fn().mockRejectedValue(new Error("M_CONFLICT (409): balance would be negative"));
    const dataProvider = makeMockDataProvider({
      getCheckinUsers: vi.fn().mockResolvedValue({ users: [], total: 0, from: 0, limit: 50 }),
      getCheckinRecords: vi.fn().mockResolvedValue({ records: [], total: 0, from: 0, limit: 50 }),
      adjustCheckinPoints,
    });

    await act(async () => {
      render(
        <AdminContext i18nProvider={i18nProvider} dataProvider={dataProvider}>
          <CheckinAdminPage />
        </AdminContext>
      );
    });

    await user.type(screen.getByRole("textbox", { name: "Matrix user IDs" }), "@alice:test");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Signed point adjustment" }), {
      target: { value: "-3" },
    });
    await user.click(screen.getByRole("button", { name: "Review adjustment" }));
    await user.click(screen.getByRole("button", { name: "Apply adjustment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Point adjustment failed: M_CONFLICT (409): balance would be negative"
    );
    const originalRequestId = adjustCheckinPoints.mock.calls[0][0].request_id;

    await user.click(screen.getByRole("button", { name: "Review adjustment" }));
    await user.click(screen.getByRole("button", { name: "Apply adjustment" }));

    await waitFor(() => expect(adjustCheckinPoints).toHaveBeenCalledTimes(2));
    expect(adjustCheckinPoints.mock.calls[1][0].request_id).toBe(originalRequestId);
  });
});
