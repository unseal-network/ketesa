import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import polyglotI18nProvider from "ra-i18n-polyglot";
import { AdminContext } from "react-admin";

import englishMessages from "../i18n/en";
import CheckinSettingsPage from "./CheckinSettingsPage";

const notifyMock = vi.hoisted(() => vi.fn());

vi.mock("react-admin", async importOriginal => {
  const actual = await importOriginal<typeof import("react-admin")>();
  return { ...actual, useNotify: () => notifyMock };
});

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
  getCheckinSettings: vi.fn(),
  setCheckinSettings: vi.fn(),
  ...overrides,
});

const renderPage = (dataProvider: ReturnType<typeof makeMockDataProvider>) =>
  render(
    <AdminContext i18nProvider={i18nProvider} dataProvider={dataProvider}>
      <CheckinSettingsPage />
    </AdminContext>
  );

const waitForSettingsInput = async () => {
  await waitFor(() => expect(screen.getByRole("spinbutton")).toBeInTheDocument());
  return screen.getByRole("spinbutton") as HTMLInputElement;
};

describe("CheckinSettingsPage", () => {
  it("loads and saves zero without treating it as empty", async () => {
    const user = userEvent.setup();
    const setCheckinSettings = vi.fn().mockResolvedValue({ points_per_checkin: 0 });
    const dataProvider = makeMockDataProvider({
      getCheckinSettings: vi.fn().mockResolvedValue({ points_per_checkin: 0 }),
      setCheckinSettings,
    });

    await act(async () => {
      renderPage(dataProvider);
    });
    const input = await waitForSettingsInput();
    expect(input.value).toBe("0");
    await user.clear(input);
    await user.type(input, "0");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(setCheckinSettings).toHaveBeenCalledWith({ points_per_checkin: 0 }));
  });

  it("saves the upper bound exactly", async () => {
    const user = userEvent.setup();
    const setCheckinSettings = vi.fn().mockResolvedValue({ points_per_checkin: 1_000_000 });
    const dataProvider = makeMockDataProvider({
      getCheckinSettings: vi.fn().mockResolvedValue({ points_per_checkin: 0 }),
      setCheckinSettings,
    });

    await act(async () => {
      renderPage(dataProvider);
    });
    const input = await waitForSettingsInput();
    await user.clear(input);
    await user.type(input, "1000000");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(setCheckinSettings).toHaveBeenCalledWith({ points_per_checkin: 1_000_000 }));
  });

  it.each(["", "-1", "1.5", "1000001"])("does not submit invalid value %j", async invalidValue => {
    const user = userEvent.setup();
    const setCheckinSettings = vi.fn();
    const dataProvider = makeMockDataProvider({
      getCheckinSettings: vi.fn().mockResolvedValue({ points_per_checkin: 10 }),
      setCheckinSettings,
    });

    await act(async () => {
      renderPage(dataProvider);
    });
    const input = await waitForSettingsInput();
    fireEvent.change(input, { target: { value: invalidValue } });
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(setCheckinSettings).not.toHaveBeenCalled();
  });

  it("refreshes after success and keeps the entered value after failure", async () => {
    notifyMock.mockClear();
    const user = userEvent.setup();
    const getCheckinSettings = vi
      .fn()
      .mockResolvedValueOnce({ points_per_checkin: 5 })
      .mockResolvedValueOnce({ points_per_checkin: 7 });
    const setCheckinSettings = vi.fn().mockResolvedValue({ points_per_checkin: 5 });
    const dataProvider = makeMockDataProvider({ getCheckinSettings, setCheckinSettings });

    await act(async () => {
      renderPage(dataProvider);
    });
    const input = await waitForSettingsInput();
    await user.clear(input);
    await user.type(input, "7");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(getCheckinSettings).toHaveBeenCalledTimes(2));
    expect(input.value).toBe("7");
    expect(notifyMock).toHaveBeenCalledWith("resources.checkin_settings.action.save_success");

    setCheckinSettings.mockRejectedValueOnce(new Error("failed"));
    await user.clear(input);
    await user.type(input, "8");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(setCheckinSettings).toHaveBeenCalledTimes(2));
    expect(input.value).toBe("8");
    expect(notifyMock).toHaveBeenCalledWith("resources.checkin_settings.action.save_failure", { type: "error" });
  });
});
