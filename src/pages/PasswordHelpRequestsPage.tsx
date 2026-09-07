import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import {
  Alert,
  Badge,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Title, useDataProvider, useNotify, useTranslate } from "react-admin";
import { useNavigate } from "react-router-dom";

import { useDocTitle } from "../components/hooks/useDocTitle";
import { PasswordHelpRequest, PasswordHelpRequestStatus, SynapseDataProvider } from "../providers/types";

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const REQUEST_STATUSES: PasswordHelpRequestStatus[] = ["PENDING", "RESOLVED", "DISMISSED"];

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

export const PasswordHelpRequestsBadge = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider() as SynapseDataProvider;
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(async () => {
    try {
      const result = await dataProvider.getPasswordHelpRequests({ from: 0, limit: 1, status: "PENDING" });
      setPendingCount(result.total);
    } catch {
      // A missing optional site feature should not make the admin navigation unusable.
    }
  }, [dataProvider]);

  useEffect(() => {
    void fetchPendingCount();
    const interval = window.setInterval(() => void fetchPendingCount(), 60_000);
    return () => window.clearInterval(interval);
  }, [fetchPendingCount]);

  const label = translate("resources.password_help_requests.pending_count", { smart_count: pendingCount });
  return (
    <Tooltip title={label}>
      <Badge badgeContent={pendingCount > 99 ? "99+" : pendingCount} color="error" overlap="circular">
        <HelpOutlineIcon aria-label={label} />
      </Badge>
    </Tooltip>
  );
};

const PasswordHelpRequestsPage = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const navigate = useNavigate();
  const dataProvider = useDataProvider() as SynapseDataProvider;
  const [status, setStatus] = useState<PasswordHelpRequestStatus>("PENDING");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [requests, setRequests] = useState<PasswordHelpRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useDocTitle(translate("resources.password_help_requests.name", { smart_count: 2 }));

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await dataProvider.getPasswordHelpRequests({
        from: page * rowsPerPage,
        limit: rowsPerPage,
        status,
      });
      setRequests(result.requests);
      setTotal(result.total);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [dataProvider, page, rowsPerPage, status]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const changeStatus = async (
    request: PasswordHelpRequest,
    nextStatus: Exclude<PasswordHelpRequestStatus, "PENDING">
  ) => {
    setUpdatingId(request.id);
    try {
      await dataProvider.updatePasswordHelpRequest(request.id, nextStatus);
      notify(`resources.password_help_requests.action.${nextStatus === "RESOLVED" ? "resolve" : "dismiss"}_success`);
      await fetchRequests();
    } catch {
      notify("resources.password_help_requests.action.update_failure", { type: "error" });
    } finally {
      setUpdatingId(null);
    }
  };

  const statusLabel = (value: PasswordHelpRequestStatus) =>
    translate(`resources.password_help_requests.status.${value.toLowerCase()}`);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Title title={translate("resources.password_help_requests.name", { smart_count: 2 })} />
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography variant="h5">{translate("resources.password_help_requests.name", { smart_count: 2 })}</Typography>
        <Typography variant="body2" color="text.secondary">
          {translate("resources.password_help_requests.description")}
        </Typography>
      </Stack>

      <Paper variant="outlined">
        <Tabs
          value={status}
          onChange={(_, nextStatus: PasswordHelpRequestStatus) => {
            setStatus(nextStatus);
            setPage(0);
          }}
          aria-label={translate("resources.password_help_requests.name", { smart_count: 2 })}
          variant="scrollable"
          scrollButtons="auto"
        >
          {REQUEST_STATUSES.map(nextStatus => (
            <Tab key={nextStatus} value={nextStatus} label={statusLabel(nextStatus)} />
          ))}
        </Tabs>

        {loading && <LinearProgress aria-label="loading" />}
        {failed && (
          <Alert severity="error" sx={{ m: 2 }}>
            {translate("resources.password_help_requests.load_failure")}
          </Alert>
        )}

        <TableContainer sx={{ overflowX: "auto" }}>
          <Table
            size="small"
            aria-label={translate("resources.password_help_requests.name", { smart_count: 2 })}
            sx={{ minWidth: 900 }}
          >
            <TableHead>
              <TableRow>
                <TableCell>{translate("resources.password_help_requests.fields.user_id")}</TableCell>
                <TableCell>{translate("resources.password_help_requests.fields.first_requested_at")}</TableCell>
                <TableCell>{translate("resources.password_help_requests.fields.last_requested_at")}</TableCell>
                <TableCell align="right">
                  {translate("resources.password_help_requests.fields.request_count")}
                </TableCell>
                <TableCell>{translate("resources.password_help_requests.fields.status")}</TableCell>
                <TableCell align="right">{translate("resources.password_help_requests.fields.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && !failed && requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    {translate("resources.password_help_requests.empty")}
                  </TableCell>
                </TableRow>
              )}
              {requests.map(request => (
                <TableRow key={request.id} hover>
                  <TableCell>{request.user_id}</TableCell>
                  <TableCell>{formatTimestamp(request.first_requested_at)}</TableCell>
                  <TableCell>{formatTimestamp(request.last_requested_at)}</TableCell>
                  <TableCell align="right">{request.request_count}</TableCell>
                  <TableCell>{statusLabel(request.status)}</TableCell>
                  <TableCell align="right">
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="flex-end" gap={0.5}>
                      <Button size="small" onClick={() => navigate(`/users/${encodeURIComponent(request.user_id)}`)}>
                        {translate("resources.password_help_requests.action.open_user")}
                      </Button>
                      {request.status === "PENDING" && (
                        <>
                          <Button
                            size="small"
                            color="success"
                            disabled={updatingId !== null}
                            onClick={() => void changeStatus(request, "RESOLVED")}
                          >
                            {translate("resources.password_help_requests.action.resolve")}
                          </Button>
                          <Button
                            size="small"
                            color="inherit"
                            disabled={updatingId !== null}
                            onClick={() => void changeStatus(request, "DISMISSED")}
                          >
                            {translate("resources.password_help_requests.action.dismiss")}
                          </Button>
                        </>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={PAGE_SIZE_OPTIONS}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={event => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
        />
      </Paper>
    </Box>
  );
};

export default PasswordHelpRequestsPage;
