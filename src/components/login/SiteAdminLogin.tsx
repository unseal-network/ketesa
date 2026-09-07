import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Alert, Box, Button, CircularProgress, Divider, Stack, TextField, Typography } from "@mui/material";
import { useLogin, useTranslate } from "react-admin";

import { SiteBinding } from "../../utils/site-binding";
import {
  Admin2FAError,
  createAdminDeviceId,
  getAdmin2FAField,
  getEnrollmentFromError,
  startAdmin2FA,
  submitAdminPassword,
  verifyAdmin2FA,
} from "../../providers/admin2fa";

type Step = "username" | "authenticate" | "enroll";

const codePattern = /^\d{6}$/;

const EnrollmentQr = ({ uri }: { uri: string }) => {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(uri, { width: 208, margin: 2, errorCorrectionLevel: "M" }).then(value => {
      if (mounted) setSrc(value);
    });
    return () => {
      mounted = false;
    };
  }, [uri]);

  return src ? (
    <Box component="img" src={src} alt="" sx={{ width: 208, height: 208, display: "block", borderRadius: 1 }} />
  ) : (
    <Box sx={{ width: 208, height: 208, display: "grid", placeItems: "center", bgcolor: "action.hover" }}>
      <CircularProgress size={24} />
    </Box>
  );
};

const manualSecret = (uri: string) => {
  try {
    return new URL(uri).searchParams.get("secret") || "";
  } catch {
    return "";
  }
};

interface Props {
  siteBinding: SiteBinding;
  welcomeTo: string;
}

export const SiteAdminLogin = ({ siteBinding, welcomeTo }: Props) => {
  const translate = useTranslate();
  const login = useLogin();
  const [step, setStep] = useState<Step>("username");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [enrollmentUri, setEnrollmentUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const secret = useMemo(() => manualSecret(enrollmentUri), [enrollmentUri]);

  const failure = () => translate("ketesa.auth.admin2fa.invalid");
  const handleUsername = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user.trim()) return;
    setBusy(true);
    setError("");
    const nextDeviceId = createAdminDeviceId();
    try {
      const result = await startAdmin2FA(siteBinding.homeserverUrl, user.trim(), nextDeviceId);
      if (result.flow !== "ENROLL" && result.flow !== "AUTHENTICATE") throw new Error("invalid flow");
      setDeviceId(nextDeviceId);
      setChallengeId(result.challenge_id);
      setStep(result.flow === "ENROLL" ? "enroll" : "authenticate");
    } catch {
      setError(failure());
    } finally {
      setBusy(false);
    }
  };

  const finishLogin = async () => {
    // The final standard password request is the only request that can receive
    // and persist an access token. The challenge is consumed server-side.
    await login({
      base_url: siteBinding.homeserverUrl,
      username: user,
      password,
      device_id: deviceId,
      admin2fa: { challengeId, deviceId },
    });
    setPassword("");
    setCode("");
  };

  const handleVerification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || (!codePattern.test(code) && (step === "authenticate" || !!enrollmentUri))) return;
    setBusy(true);
    setError("");
    try {
      let verifiedChallengeId = challengeId;
      if (step === "enroll" && !enrollmentUri) {
        try {
          await submitAdminPassword(siteBinding.homeserverUrl, user, password, deviceId);
          throw new Error("unexpected password success");
        } catch (submissionError) {
          const enrollment = getEnrollmentFromError(submissionError);
          if (!enrollment) throw submissionError;
          verifiedChallengeId = enrollment.challenge_id;
          setChallengeId(verifiedChallengeId);
          setEnrollmentUri(enrollment.otpauth_uri);
          return;
        }
      }
      if (step === "authenticate") {
        try {
          await submitAdminPassword(siteBinding.homeserverUrl, user, password, deviceId);
          throw new Error("unexpected password success");
        } catch (submissionError) {
          const field = getAdmin2FAField(submissionError);
          if (!field) throw submissionError;
          if (typeof field.challenge_id === "string") {
            verifiedChallengeId = field.challenge_id;
            setChallengeId(verifiedChallengeId);
          }
        }
      }
      await verifyAdmin2FA(siteBinding.homeserverUrl, verifiedChallengeId, code);
      await finishLogin();
    } catch (submissionError) {
      if (submissionError instanceof Admin2FAError && getAdmin2FAField(submissionError)) setError(failure());
      else if (submissionError instanceof Error && submissionError.message === "unexpected password success")
        setError(failure());
      else setError(failure());
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep("username");
    setUser("");
    setPassword("");
    setCode("");
    setDeviceId("");
    setChallengeId("");
    setEnrollmentUri("");
    setError("");
  };

  return (
    <Box
      sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", px: 2, py: 4, bgcolor: "background.default" }}
    >
      <Box sx={{ width: "100%", maxWidth: 430 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {translate("ketesa.auth.admin2fa.label")}
            </Typography>
            <Typography variant="h4" component="h1" sx={{ mt: 0.5, fontWeight: 700 }}>
              {welcomeTo}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {translate("ketesa.auth.admin2fa.description")}
            </Typography>
            {siteBinding.serverName && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {siteBinding.serverName}
              </Typography>
            )}
          </Box>
          <Box component="form" onSubmit={step === "username" ? handleUsername : handleVerification} noValidate>
            <Stack spacing={2.25}>
              {step === "username" ? (
                <>
                  <TextField
                    label={translate("ra.auth.username")}
                    value={user}
                    onChange={e => setUser(e.target.value)}
                    autoComplete="username"
                    fullWidth
                    autoFocus
                    disabled={busy}
                  />
                  <Button type="submit" variant="contained" size="large" fullWidth disabled={busy || !user.trim()}>
                    {busy ? <CircularProgress size={22} color="inherit" /> : translate("ketesa.auth.admin2fa.continue")}
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="subtitle1" sx={{ fontWeight: 650 }}>
                    {step === "enroll"
                      ? translate("ketesa.auth.admin2fa.enroll_title")
                      : translate("ketesa.auth.admin2fa.verify_title")}
                  </Typography>
                  {step === "enroll" && enrollmentUri && (
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      alignItems={{ xs: "center", sm: "flex-start" }}
                    >
                      <EnrollmentQr uri={enrollmentUri} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" color="text.secondary">
                          {translate("ketesa.auth.admin2fa.scan_hint")}
                        </Typography>
                        {secret && (
                          <Typography
                            component="code"
                            sx={{ display: "block", mt: 1, wordBreak: "break-all", fontSize: "0.78rem" }}
                          >
                            {secret}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  )}
                  {!(step === "enroll" && !!enrollmentUri) && (
                    <TextField
                      label={translate("ra.auth.password")}
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      fullWidth
                      autoFocus
                      disabled={busy}
                    />
                  )}
                  {(step !== "enroll" || !!enrollmentUri) && (
                    <TextField
                      label={translate("ketesa.auth.admin2fa.code")}
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputProps={{ inputMode: "numeric", pattern: "[0-9]{6}", maxLength: 6 }}
                      autoComplete="one-time-code"
                      fullWidth
                      disabled={busy}
                    />
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={
                      busy ||
                      !password ||
                      (step !== "enroll" && !codePattern.test(code)) ||
                      (!!enrollmentUri && !codePattern.test(code))
                    }
                  >
                    {busy ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      translate(
                        step === "enroll" && !enrollmentUri
                          ? "ketesa.auth.admin2fa.continue"
                          : "ketesa.auth.admin2fa.sign_in"
                      )
                    )}
                  </Button>
                  <Button type="button" onClick={reset} disabled={busy} color="inherit">
                    {translate("ketesa.auth.admin2fa.use_different_account")}
                  </Button>
                </>
              )}
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </Box>
          <Divider />
          <Typography variant="caption" color="text.secondary">
            {translate("ketesa.auth.admin2fa.security_note")}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};

export default SiteAdminLogin;
