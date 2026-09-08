import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import polyglotI18nProvider from "ra-i18n-polyglot";
import { AdminContext } from "react-admin";
import { beforeEach, describe, expect, it, vi } from "vitest";

import englishMessages from "../i18n/en";
import StatisticsPage from "./StatisticsPage";

vi.mock("../components/hooks/useDocTitle", () => ({ useDocTitle: vi.fn() }));

const i18nProvider = polyglotI18nProvider(() => englishMessages, "en", [{ locale: "en", name: "English" }]);

const report = {
  from: "2026-09-01",
  to: "2026-09-03",
  generated_at: "2026-09-03T12:00:00Z",
  timezone: "Asia/Shanghai",
  definition_version: 1,
  dataset_enabled: true,
  coverage: {
    registrations: { start: "2026-09-01", end: "2026-09-03", integrity: "complete", sources: {} },
    sync: { start: "2026-09-01", end: "2026-09-03", integrity: "complete", sources: {} },
    message: { start: "2026-09-01", end: "2026-09-03", integrity: "complete", sources: {} },
    group: { start: "2026-09-01", end: "2026-09-03", status: "complete", sources: {} },
  },
  registrations: {
    total: 0,
    status: "complete",
    daily: [
      { date: "2026-09-01", value: 0 },
      { date: "2026-09-02", value: null },
    ],
  },
  sync_activity: {
    total: 2,
    status: "complete",
    daily: [
      { date: "2026-09-01", value: 2 },
      { date: "2026-09-02", value: null },
    ],
  },
  message_activity: {
    total: 1,
    status: "partial",
    daily: [
      { date: "2026-09-01", value: 1 },
      { date: "2026-09-02", value: null },
    ],
  },
  group_activity: {
    total: 1,
    unknown_total: 1,
    status: "partial",
    daily: [
      { date: "2026-09-01", groups: 1, unknown_rooms: 1 },
      { date: "2026-09-02", groups: null, unknown_rooms: null },
    ],
  },
};

const makeDataProvider = (getStatisticsReport = vi.fn().mockResolvedValue(report)) => ({
  getList: vi.fn(),
  getOne: vi.fn(),
  getMany: vi.fn(),
  getManyReference: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  getStatisticsReport,
});

const renderPage = (dataProvider: ReturnType<typeof makeDataProvider>) =>
  render(
    <AdminContext i18nProvider={i18nProvider} dataProvider={dataProvider}>
      <StatisticsPage />
    </AdminContext>
  );

describe("StatisticsPage", () => {
  beforeEach(() => localStorage.clear());

  it("renders zero separately from an uncovered null and sends the selected half-open range", async () => {
    const user = userEvent.setup();
    const getStatisticsReport = vi.fn().mockResolvedValue(report);
    renderPage(makeDataProvider(getStatisticsReport));

    expect((await screen.findAllByText("New registrations")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText(/Unknown rooms/)).toBeInTheDocument();

    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");
    await user.clear(from);
    await user.type(from, "2026-09-01");
    await user.clear(to);
    await user.type(to, "2026-09-04");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(getStatisticsReport).toHaveBeenLastCalledWith({ from: "2026-09-01", to: "2026-09-04" }));
  });

  it("keeps a visible loading state until the real response arrives", async () => {
    let resolveReport!: (value: typeof report) => void;
    const getStatisticsReport = vi.fn().mockReturnValue(
      new Promise<typeof report>(resolve => {
        resolveReport = resolve;
      })
    );
    renderPage(makeDataProvider(getStatisticsReport));
    expect(screen.getByLabelText("Loading statistics")).toBeInTheDocument();
    resolveReport(report);
    expect(await screen.findByText("Daily trend")).toBeInTheDocument();
  });

  it("shows unavailable totals as not collected instead of a false zero", async () => {
    const unavailableReport = {
      ...report,
      registrations: { ...report.registrations, total: 0, status: "unavailable" },
    };
    renderPage(makeDataProvider(vi.fn().mockResolvedValue(unavailableReport)));
    expect((await screen.findAllByText("Not collected")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Partial").length).toBeGreaterThan(0);
  });

  it("refreshes only when the admin asks and does not poll", async () => {
    const user = userEvent.setup();
    const getStatisticsReport = vi.fn().mockResolvedValue(report);
    renderPage(makeDataProvider(getStatisticsReport));
    await screen.findByText("Daily trend");
    expect(getStatisticsReport).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(getStatisticsReport).toHaveBeenCalledTimes(2));
  });

  it.each([401, 403, 500])("shows a bounded error state for HTTP %s without polling", async status => {
    const getStatisticsReport = vi.fn().mockRejectedValue({ status });
    renderPage(makeDataProvider(getStatisticsReport));
    const message =
      status === 401 || status === 403
        ? "You do not have permission to view statistics."
        : "Statistics are temporarily unavailable.";
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(getStatisticsReport).toHaveBeenCalledTimes(1);
  });
});
