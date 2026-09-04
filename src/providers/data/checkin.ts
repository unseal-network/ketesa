import { jsonClient } from "../http";
import { CheckinQuery, CheckinRecordsPage, CheckinSettings, CheckinUsersPage } from "../types";

const CHECKIN_SETTINGS_PATH = "/_synapse/client/site/v1/admin/checkin/settings";
const CHECKIN_USERS_PATH = "/_synapse/client/site/v1/admin/checkin/users";
const CHECKIN_RECORDS_PATH = "/_synapse/client/site/v1/admin/checkin/records";

const getCheckinAdminUrl = (path: string, query?: CheckinQuery) => {
  const baseUrl = localStorage.getItem("base_url");
  if (!baseUrl) throw new Error("Homeserver not set");
  if (!query) return `${baseUrl}${path}`;
  const params = new URLSearchParams({ from: String(query.from), limit: String(query.limit) });
  if (query.search) params.set("search", query.search);
  if (query.from_date) params.set("from_date", query.from_date);
  if (query.to_date) params.set("to_date", query.to_date);
  return `${baseUrl}${path}?${params.toString()}`;
};

export const getCheckinSettings = async (): Promise<CheckinSettings> => {
  const { json } = await jsonClient(getCheckinAdminUrl(CHECKIN_SETTINGS_PATH));
  return json as CheckinSettings;
};

export const setCheckinSettings = async (settings: CheckinSettings): Promise<CheckinSettings> => {
  const { json } = await jsonClient(getCheckinAdminUrl(CHECKIN_SETTINGS_PATH), {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  return (json ?? settings) as CheckinSettings;
};

export const getCheckinUsers = async (query: CheckinQuery): Promise<CheckinUsersPage> => {
  const { json } = await jsonClient(getCheckinAdminUrl(CHECKIN_USERS_PATH, query));
  return json as CheckinUsersPage;
};

export const getCheckinRecords = async (query: CheckinQuery): Promise<CheckinRecordsPage> => {
  const { json } = await jsonClient(getCheckinAdminUrl(CHECKIN_RECORDS_PATH, query));
  return json as CheckinRecordsPage;
};
