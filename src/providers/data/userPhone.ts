import { HttpError } from "react-admin";

import { jsonClient } from "../http";
import { UserPhone } from "../types";

export const USER_PHONE_PATH = "/_synapse/client/site/v1/admin/users/phone";

const getUserPhoneUrl = (userId: string) => {
  const baseUrl = localStorage.getItem("base_url");
  if (!baseUrl) throw new Error("Homeserver not set");
  const params = new URLSearchParams({ user_id: userId });
  return `${baseUrl}${USER_PHONE_PATH}?${params.toString()}`;
};

/**
 * Fetches the optional phone remark a user entered at registration.
 * Resolves to null when the homeserver does not provide the endpoint (404),
 * so older servers show the field as unavailable instead of failing.
 */
export const getUserPhone = async (userId: string): Promise<UserPhone | null> => {
  try {
    const { json } = await jsonClient(getUserPhoneUrl(userId));
    return json as UserPhone;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
};
