import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LockResetIcon from "@mui/icons-material/LockReset";
import {
  Button as MuiButton,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useLayoutEffect, useRef, useState } from "react";
import { Button, useDataProvider, useNotify, useRecordContext, useTranslate } from "react-admin";

import { SynapseDataProvider } from "../../../providers/types";

export const ResetPasswordButton = () => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const record = useRecordContext();
  const recordId = record?.id ? String(record.id) : "";
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [target, setTarget] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestVersion = useRef(0);
  const previousRecordId = useRef(recordId);
  const notify = useNotify();
  const translate = useTranslate();
  const dataProvider = useDataProvider() as SynapseDataProvider;

  const clearSecrets = () => {
    setPassword("");
    setConfirmation("");
    setTarget("");
    setShowPassword(false);
    setShowConfirmation(false);
  };

  useLayoutEffect(() => {
    if (previousRecordId.current !== recordId) {
      requestVersion.current += 1;
      previousRecordId.current = recordId;
      setPassword("");
      setConfirmation("");
      setTarget("");
      setShowPassword(false);
      setShowConfirmation(false);
      setOpen(false);
      setLoading(false);
    }

    return () => {
      requestVersion.current += 1;
    };
  }, [recordId]);

  if (!record) return null;

  const handleOpen = () => {
    clearSecrets();
    setOpen(true);
  };

  const handleClose = () => {
    requestVersion.current += 1;
    clearSecrets();
    setOpen(false);
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (loading) return;
    if (!password) {
      notify("resources.users.action.reset_password.error_no_password", { type: "error" });
      return;
    }
    if (password !== confirmation) {
      notify("resources.users.action.reset_password.error_password_mismatch", { type: "error" });
      return;
    }
    if (target !== recordId) {
      notify("resources.users.action.reset_password.error_target_mismatch", { type: "error" });
      return;
    }

    const version = ++requestVersion.current;
    const requestedRecordId = recordId;
    setLoading(true);
    try {
      const result = await dataProvider.resetPassword(requestedRecordId, password, true);
      if (version !== requestVersion.current || !open || requestedRecordId !== String(record?.id ?? "")) return;
      if (result.success) {
        notify("resources.users.action.reset_password.success", { type: "success" });
        handleClose();
      } else {
        notify(result.error || "resources.users.action.reset_password.failure", { type: "error" });
      }
    } catch {
      if (version === requestVersion.current && open && requestedRecordId === String(record?.id ?? "")) {
        notify("resources.users.action.reset_password.failure", { type: "error" });
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  const canConfirm = Boolean(password && confirmation && password === confirmation && target === recordId);
  const passwordAdornment = (visible: boolean, setVisible: (value: boolean) => void, label: string) => (
    <InputAdornment position="end">
      <IconButton onClick={() => setVisible(!visible)} edge="end" aria-label={translate(label)} disabled={loading}>
        {visible ? <VisibilityOff /> : <Visibility />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <>
      <Button label="resources.users.action.reset_password.label" onClick={handleOpen} disabled={loading}>
        <LockResetIcon />
      </Button>
      <Dialog open={open} onClose={loading ? undefined : handleClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
        <DialogTitle>{translate("resources.users.action.reset_password.title")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {translate("resources.users.action.reset_password.helper", { user: recordId })}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            required
            disabled={loading}
            type={showPassword ? "text" : "password"}
            label={translate("resources.users.action.reset_password.password")}
            value={password}
            onChange={event => setPassword(event.target.value)}
            autoComplete="new-password"
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                endAdornment: passwordAdornment(
                  showPassword,
                  setShowPassword,
                  "resources.users.action.reset_password.show_password"
                ),
              },
            }}
          />
          <TextField
            fullWidth
            required
            disabled={loading}
            type={showConfirmation ? "text" : "password"}
            label={translate("resources.users.action.reset_password.confirm_password")}
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            autoComplete="new-password"
            error={Boolean(confirmation && password !== confirmation)}
            helperText={
              confirmation && password !== confirmation
                ? translate("resources.users.action.reset_password.error_password_mismatch")
                : undefined
            }
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                endAdornment: passwordAdornment(
                  showConfirmation,
                  setShowConfirmation,
                  "resources.users.action.reset_password.show_password"
                ),
              },
            }}
          />
          <TextField
            fullWidth
            required
            disabled={loading}
            label={translate("resources.users.action.reset_password.target")}
            value={target}
            onChange={event => setTarget(event.target.value)}
            autoComplete="off"
            error={Boolean(target && target !== recordId)}
            helperText={
              target && target !== recordId
                ? translate("resources.users.action.reset_password.error_target_mismatch")
                : translate("resources.users.action.reset_password.target_helper", { user: recordId })
            }
          />
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={handleClose} disabled={loading}>
            {translate("ra.action.cancel")}
          </MuiButton>
          <MuiButton
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className="ra-confirm RaConfirm-confirmPrimary"
            startIcon={
              loading ? (
                <CircularProgress size={18} aria-label={translate("resources.users.action.reset_password.saving")} />
              ) : undefined
            }
          >
            {translate(loading ? "resources.users.action.reset_password.saving" : "ra.action.confirm")}
          </MuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ResetPasswordButton;
