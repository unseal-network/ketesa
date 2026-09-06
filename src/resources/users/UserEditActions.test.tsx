import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminContext, DataProvider, RecordContextProvider } from "react-admin";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "../../i18n/en";

let masMode = false;
vi.mock("../../providers/data/mas", async () => {
  const actual = await vi.importActual<typeof import("../../providers/data/mas")>("../../providers/data/mas");
  return { ...actual, useIsMAS: () => masMode };
});

import { UserEditActions } from "./UserEditActions";

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
} as unknown as DataProvider;

const renderActions = () =>
  render(
    <AdminContext i18nProvider={i18nProvider} dataProvider={dataProvider}>
      <RecordContextProvider value={{ id: "@alice:example.org", deactivated: false }}>
        <UserEditActions />
      </RecordContextProvider>
    </AdminContext>
  );

describe("UserEditActions", () => {
  beforeEach(() => {
    masMode = false;
    localStorage.clear();
  });

  it("retains ordinary account controls but exposes no credential or impersonation actions", () => {
    renderActions();
    expect(screen.getByRole("button", { name: /allow cross-signing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /renew account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send server notices/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /password|login as|impersonate/i })).not.toBeInTheDocument();
  });

  it("retains MAS-safe notices without exposing password management", () => {
    masMode = true;
    renderActions();
    expect(screen.getByRole("button", { name: /send server notices/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /password|login as|impersonate/i })).not.toBeInTheDocument();
  });
});
