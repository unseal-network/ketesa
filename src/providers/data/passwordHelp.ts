import {
  PasswordHelpRequest,
  PasswordHelpRequestsPage,
  PasswordHelpRequestsQuery,
  PasswordHelpRequestStatus,
} from "../types";
import { jsonClient } from "../http";

export const PASSWORD_HELP_REQUESTS_PATH = "/_synapse/client/site/v1/admin/password-help-requests";

const getPasswordHelpRequestsUrl = (query?: PasswordHelpRequestsQuery) => {
  const baseUrl = localStorage.getItem("base_url");
  if (!baseUrl) throw new Error("Homeserver not set");
  if (!query) return `${baseUrl}${PASSWORD_HELP_REQUESTS_PATH}`;

  const params = new URLSearchParams({
    from: String(query.from),
    limit: String(query.limit),
    status: query.status || "PENDING",
  });
  return `${baseUrl}${PASSWORD_HELP_REQUESTS_PATH}?${params.toString()}`;
};

export const getPasswordHelpRequests = async (query: PasswordHelpRequestsQuery): Promise<PasswordHelpRequestsPage> => {
  const { json } = await jsonClient(getPasswordHelpRequestsUrl(query));
  return json as PasswordHelpRequestsPage;
};

export const updatePasswordHelpRequest = async (
  requestId: string,
  status: Exclude<PasswordHelpRequestStatus, "PENDING">
): Promise<PasswordHelpRequest> => {
  const { json } = await jsonClient(getPasswordHelpRequestsUrl(), {
    method: "PUT",
    // The server calls this identifier request_id; the table/API response exposes it as id.
    body: JSON.stringify({ request_id: requestId, status }),
  });
  return json as PasswordHelpRequest;
};
