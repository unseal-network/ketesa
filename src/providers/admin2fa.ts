import { GetConfig } from "../utils/config";

export type Admin2FAFlow = "ENROLL" | "AUTHENTICATE";

export interface Admin2FAChallenge {
  challenge_id: string;
  flow: Admin2FAFlow;
}

export interface Admin2FAEnrollment {
  challenge_id: string;
  otpauth_uri: string;
}

export class Admin2FAError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message);
    this.name = "Admin2FAError";
    this.status = status;
    this.body = body;
  }
}

const endpoint = (baseUrl: string, path: string) => `${baseUrl.replace(/\/+$/g, "")}${path}`;

const parseBody = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const request = async (url: string, body: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: "POST",
    credentials: GetConfig().corsCredentials as RequestCredentials,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await parseBody(response);
  if (!response.ok) {
    throw new Admin2FAError("Admin authentication failed", response.status, json);
  }
  return json;
};

export const createAdminDeviceId = (): string => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return `KETESA-${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}`;
};

export const startAdmin2FA = (baseUrl: string, user: string, deviceId: string) =>
  request(endpoint(baseUrl, "/_synapse/client/site/v1/admin-2fa/login/start"), {
    user,
    device_id: deviceId,
  }) as unknown as Promise<Admin2FAChallenge>;

/** Submit the standard Matrix password request. The server deliberately returns 403
 * with an admin 2FA field before assurance is established. */
export const submitAdminPassword = async (baseUrl: string, user: string, password: string, deviceId: string) => {
  const result = await request(endpoint(baseUrl, "/_matrix/client/v3/login"), {
    type: "m.login.password",
    identifier: { type: "m.id.user", user },
    password,
    device_id: deviceId,
  });
  const unexpectedToken = result.access_token;
  if (typeof unexpectedToken === "string") {
    try {
      await fetch(endpoint(baseUrl, "/_matrix/client/v3/logout"), {
        method: "POST",
        credentials: GetConfig().corsCredentials as RequestCredentials,
        headers: { Accept: "application/json", Authorization: `Bearer ${unexpectedToken}` },
      });
    } catch {
      // The caller still fails closed if best-effort revocation cannot complete.
    }
  }
  return result;
};

export const verifyAdmin2FA = (baseUrl: string, challengeId: string, code: string) =>
  request(endpoint(baseUrl, "/_synapse/client/site/v1/admin-2fa/login/verify"), {
    challenge_id: challengeId,
    code,
  });

export const getAdmin2FASession = async (baseUrl: string, token: string): Promise<Record<string, unknown>> => {
  const response = await fetch(endpoint(baseUrl, "/_synapse/client/site/v1/admin-2fa/session"), {
    credentials: GetConfig().corsCredentials as RequestCredentials,
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const json = await parseBody(response);
  if (!response.ok) throw new Admin2FAError("Admin session assurance failed", response.status, json);
  const assurance = json.assurance ?? json.admin_2fa ?? json.two_factor;
  const factorCount = json.factor_count;
  if (
    json.authorized !== true ||
    typeof factorCount !== "number" ||
    !Number.isInteger(factorCount) ||
    factorCount < 1 ||
    assurance === false ||
    assurance === "none" ||
    assurance === "password"
  ) {
    throw new Admin2FAError("Admin session is not assured", response.status, json);
  }
  return json;
};

const adminField = (body: Record<string, unknown>): Record<string, unknown> | null => {
  const candidates = [body["io.auto_release.admin_2fa"], body.additional, body.admin_2fa];
  return candidates.find(value => value && typeof value === "object") as Record<string, unknown> | null;
};

export const getAdmin2FAField = (error: unknown): Record<string, unknown> | null => {
  if (!(error instanceof Admin2FAError)) return null;
  return adminField(error.body);
};

export const getEnrollmentFromError = (error: unknown): Admin2FAEnrollment | null => {
  const field = getAdmin2FAField(error);
  const challengeId = field?.challenge_id;
  const uri = field?.otpauth_uri;
  return typeof challengeId === "string" && typeof uri === "string"
    ? { challenge_id: challengeId, otpauth_uri: uri }
    : null;
};
