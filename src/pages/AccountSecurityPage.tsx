import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Add, DeleteOutline, Security } from "@mui/icons-material";
import QRCode from "qrcode";
import { Title, useNotify, useTranslate } from "react-admin";

import { useDocTitle } from "../components/hooks/useDocTitle";
import { GetConfig } from "../utils/config";

interface Factor {
  id: string;
  name?: string;
  created_at?: string | number;
  createdAt?: string | number;
  otpauth_uri?: string;
}

const factorsPath = "/_synapse/client/site/v1/admin-2fa/factors";

const factorRequest = async (method: string, path = factorsPath, body?: Record<string, unknown>) => {
  const token = localStorage.getItem("access_token");
  const baseUrl = localStorage.getItem("base_url");
  if (!baseUrl || !token) throw new Error("Missing authenticated session");
  const response = await fetch(`${baseUrl.replace(/\/+$/g, "")}${path}`, {
    method,
    credentials: GetConfig().corsCredentials as RequestCredentials,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    // Empty response bodies are valid for DELETE.
  }
  if (!response.ok) throw new Error("request failed");
  return json;
};

const NewFactorQr = ({ uri }: { uri: string }) => {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(uri, { width: 190, margin: 2, errorCorrectionLevel: "M" }).then(value => {
      if (active) setSrc(value);
    });
    return () => {
      active = false;
    };
  }, [uri]);
  return src ? (
    <Box component="img" src={src} alt="" sx={{ width: 190, height: 190 }} />
  ) : (
    <CircularProgress size={24} />
  );
};

const displayDate = (factor: Factor) => {
  const date = factor.created_at ?? factor.createdAt;
  if (!date) return "";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? String(date) : parsed.toLocaleDateString();
};

const setupSecret = (uri?: string) => {
  if (!uri) return "";
  try {
    return new URL(uri).searchParams.get("secret") || "";
  } catch {
    return "";
  }
};

export const AccountSecurityPage = () => {
  const translate = useTranslate();
  const notify = useNotify();
  useDocTitle(translate("ketesa.security.title"));
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<Factor | null>(null);
  const [code, setCode] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Factor | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await factorRequest("GET");
      const list = Array.isArray(data.factors) ? data.factors : [];
      setFactors(list as Factor[]);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void loadFactors(), [loadFactors]);

  const addFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await factorRequest("POST", factorsPath, {
        name: name.trim() || translate("ketesa.security.authenticator_default"),
      });
      const rawFactor = (result.factor || result) as Factor & { factor_id?: string };
      const factor = { ...rawFactor, id: rawFactor.id || rawFactor.factor_id || "" };
      setPending(factor);
      setCode("");
    } catch {
      notify("ketesa.security.request_failed", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const confirmFactor = async () => {
    if (!pending || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try {
      await factorRequest("PUT", `${factorsPath}/${encodeURIComponent(pending.id)}`, { code });
      setPending(null);
      setName("");
      await loadFactors();
      notify("ketesa.security.added", { type: "success" });
    } catch {
      notify("ketesa.security.invalid_code", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async () => {
    if (!deleteTarget || factors.length <= 1 || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try {
      await factorRequest("DELETE", `${factorsPath}/${encodeURIComponent(deleteTarget.id)}`, { code });
      setDeleteTarget(null);
      setCode("");
      await loadFactors();
      notify("ketesa.security.removed", { type: "success" });
    } catch {
      notify("ketesa.security.invalid_code", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 760, width: "100%", mx: "auto", p: { xs: 2, sm: 4 } }}>
      <Title title={translate("ketesa.security.title")} />
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Security color="primary" />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              {translate("ketesa.security.title")}
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {translate("ketesa.security.description")}
          </Typography>
        </Box>
        {error && <Alert severity="error">{translate("ketesa.security.load_failed")}</Alert>}
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="h6">{translate("ketesa.security.factors")}</Typography>
          </Box>
          {loading ? (
            <Box sx={{ p: 3, display: "grid", placeItems: "center" }}>
              <CircularProgress size={26} />
            </Box>
          ) : (
            <List disablePadding>
              {factors.map(factor => (
                <ListItem
                  key={factor.id}
                  divider
                  secondaryAction={
                    <Button
                      color="error"
                      startIcon={<DeleteOutline />}
                      onClick={() => {
                        setCode("");
                        setDeleteTarget(factor);
                      }}
                      disabled={factors.length <= 1}
                      title={factors.length <= 1 ? translate("ketesa.security.last_factor_disabled") : undefined}
                    >
                      {translate("ra.action.delete")}
                    </Button>
                  }
                >
                  <ListItemText
                    primary={factor.name || translate("ketesa.security.authenticator_default")}
                    secondary={displayDate(factor)}
                  />
                </ListItem>
              ))}
              {!factors.length && (
                <ListItem>
                  <ListItemText primary={translate("ketesa.security.none")} />
                </ListItem>
              )}
            </List>
          )}
        </Box>
        <Box
          component="form"
          onSubmit={addFactor}
          sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2.5, bgcolor: "background.paper" }}
        >
          <Stack spacing={2}>
            <Typography variant="h6">{translate("ketesa.security.add_title")}</Typography>
            <TextField
              label={translate("ketesa.security.name")}
              value={name}
              onChange={e => setName(e.target.value)}
              fullWidth
              autoComplete="off"
              inputProps={{ maxLength: 100 }}
            />
            <Button type="submit" variant="outlined" startIcon={<Add />} disabled={busy}>
              {translate("ketesa.security.add")}
            </Button>
          </Stack>
        </Box>
      </Stack>
      <Dialog open={!!pending} onClose={() => !busy && setPending(null)} fullWidth maxWidth="xs">
        <DialogTitle>{translate("ketesa.security.confirm_title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} alignItems="center" sx={{ pt: 1 }}>
            {pending?.otpauth_uri && <NewFactorQr uri={pending.otpauth_uri} />}
            <Typography color="text.secondary" align="center">
              {translate("ketesa.security.scan_hint")}
            </Typography>
            {pending?.otpauth_uri && setupSecret(pending.otpauth_uri) && (
              <Typography component="code" sx={{ wordBreak: "break-all", fontSize: "0.78rem" }}>
                {setupSecret(pending.otpauth_uri)}
              </Typography>
            )}
            <TextField
              label={translate("ketesa.auth.admin2fa.code")}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputProps={{ inputMode: "numeric", maxLength: 6 }}
              autoComplete="one-time-code"
              fullWidth
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)} disabled={busy}>
            {translate("ra.action.cancel")}
          </Button>
          <Button onClick={confirmFactor} variant="contained" disabled={busy || !/^\d{6}$/.test(code)}>
            {translate("ra.action.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!deleteTarget} onClose={() => !busy && setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>{translate("ketesa.security.remove_title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>{translate("ketesa.security.remove_description")}</Typography>
            <TextField
              label={translate("ketesa.auth.admin2fa.code")}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputProps={{ inputMode: "numeric", maxLength: 6 }}
              fullWidth
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={busy}>
            {translate("ra.action.cancel")}
          </Button>
          <Button onClick={removeFactor} variant="contained" color="error" disabled={busy || !/^\d{6}$/.test(code)}>
            {translate("ra.action.delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountSecurityPage;
