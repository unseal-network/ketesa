import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Title, useDataProvider, useTranslate } from "react-admin";
import { useNavigate } from "react-router-dom";

import { useDocTitle } from "../components/hooks/useDocTitle";
import {
  CheckinAdjustmentRequest,
  CheckinAdjustmentResult,
  CheckinRecord,
  CheckinUserSummary,
  SynapseDataProvider,
} from "../providers/types";

type CheckinView = "users" | "records";

interface CheckinFilters {
  search: string;
  fromDate: string;
  toDate: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const INITIAL_FILTERS: CheckinFilters = { search: "", fromDate: "", toDate: "" };

interface PendingAdjustment {
  request: CheckinAdjustmentRequest;
  signature: string;
}

interface RetryRequest {
  requestId: string;
  signature: string;
}

const parseAdjustmentUserIds = (value: string) =>
  value
    .split(/\r?\n/)
    .map(userId => userId.trim())
    .filter(Boolean);

const parseAdjustmentAmount = (value: string): number | null => {
  const normalized = value.trim();
  if (!/^[+-]?\d+$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount !== 0 && Math.abs(amount) <= 1_000_000 ? amount : null;
};

const createRequestId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatAdjustment = (amount: number) => (amount > 0 ? `+${amount}` : String(amount));

const compactQuery = (filters: CheckinFilters, from: number, limit: number, includeDates: boolean) => ({
  from,
  limit,
  ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
  ...(includeDates && filters.fromDate ? { from_date: filters.fromDate } : {}),
  ...(includeDates && filters.toDate ? { to_date: filters.toDate } : {}),
});

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const CheckinAdminPage = () => {
  const translate = useTranslate();
  const navigate = useNavigate();
  const dataProvider = useDataProvider() as SynapseDataProvider;
  const [view, setView] = useState<CheckinView>("users");
  const [draftFilters, setDraftFilters] = useState<CheckinFilters>(INITIAL_FILTERS);
  const [filters, setFilters] = useState<CheckinFilters>(INITIAL_FILTERS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [users, setUsers] = useState<CheckinUserSummary[]>([]);
  const [records, setRecords] = useState<CheckinRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [adjustmentUserIds, setAdjustmentUserIds] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [attemptedReview, setAttemptedReview] = useState(false);
  const [pendingAdjustment, setPendingAdjustment] = useState<PendingAdjustment | null>(null);
  const [retryRequest, setRetryRequest] = useState<RetryRequest | null>(null);
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [adjustmentResult, setAdjustmentResult] = useState<CheckinAdjustmentResult | null>(null);
  const adjustmentUserList = useMemo(() => parseAdjustmentUserIds(adjustmentUserIds), [adjustmentUserIds]);
  const parsedAmount = useMemo(() => parseAdjustmentAmount(adjustmentAmount), [adjustmentAmount]);
  const userIdsValidation =
    adjustmentUserList.length === 0
      ? "users_required"
      : adjustmentUserList.length > 100
        ? "too_many_users"
        : new Set(adjustmentUserList).size !== adjustmentUserList.length
          ? "duplicate_users"
          : null;
  const amountValidation = parsedAmount === null ? "invalid_amount" : null;
  const invalidDateRange =
    view === "records" &&
    draftFilters.fromDate !== "" &&
    draftFilters.toDate !== "" &&
    draftFilters.fromDate > draftFilters.toDate;

  useDocTitle(translate("resources.checkin_admin.name", { smart_count: 2 }));

  const query = useMemo(
    () => compactQuery(filters, page * rowsPerPage, rowsPerPage, view === "records"),
    [filters, page, rowsPerPage, view]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const load = async () => {
      try {
        if (view === "users") {
          const result = await dataProvider.getCheckinUsers(query);
          if (!cancelled) {
            setUsers(result.users);
            setTotal(result.total);
          }
        } else {
          const result = await dataProvider.getCheckinRecords(query);
          if (!cancelled) {
            setRecords(result.records);
            setTotal(result.total);
          }
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [dataProvider, query, refreshVersion, view]);

  const reviewAdjustment = (event: FormEvent) => {
    event.preventDefault();
    setAttemptedReview(true);
    setAdjustmentError(null);
    setAdjustmentResult(null);
    if (userIdsValidation || amountValidation || parsedAmount === null) return;

    const signature = JSON.stringify({ user_ids: adjustmentUserList, amount: parsedAmount });
    const requestId = retryRequest?.signature === signature ? retryRequest.requestId : createRequestId();
    setPendingAdjustment({
      request: { request_id: requestId, user_ids: adjustmentUserList, amount: parsedAmount },
      signature,
    });
  };

  const applyAdjustment = async () => {
    if (!pendingAdjustment) return;
    setAdjustmentLoading(true);
    setAdjustmentError(null);
    try {
      const result = await dataProvider.adjustCheckinPoints(pendingAdjustment.request);
      setAdjustmentResult(result);
      setRetryRequest(null);
      setPendingAdjustment(null);
      setAdjustmentUserIds("");
      setAdjustmentAmount("");
      setAttemptedReview(false);
      setView("users");
      setPage(0);
      setRefreshVersion(version => version + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAdjustmentError(translate("resources.checkin_admin.adjustment.failure", { error: message }));
      setRetryRequest({
        requestId: pendingAdjustment.request.request_id,
        signature: pendingAdjustment.signature,
      });
      setPendingAdjustment(null);
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    if (invalidDateRange) return;
    setPage(0);
    setFilters(draftFilters);
  };

  const resetFilters = () => {
    setDraftFilters(INITIAL_FILTERS);
    setFilters(INITIAL_FILTERS);
    setPage(0);
  };

  const openUserRecords = (userId: string) => {
    const userFilter = { search: userId, fromDate: "", toDate: "" };
    setDraftFilters(userFilter);
    setFilters(userFilter);
    setPage(0);
    setView("records");
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Title title={translate("resources.checkin_admin.name", { smart_count: 2 })} />
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">{translate("resources.checkin_admin.name", { smart_count: 2 })}</Typography>
          <Typography variant="body2" color="text.secondary">
            {translate("resources.checkin_admin.description")}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<SettingsOutlinedIcon />}
          onClick={() => navigate("/checkin_settings")}
          sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
        >
          {translate("resources.checkin_admin.action.settings")}
        </Button>
      </Stack>

      <Paper component="section" variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="h6">{translate("resources.checkin_admin.adjustment.title")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {translate("resources.checkin_admin.adjustment.description")}
            </Typography>
          </Box>
          <Stack component="form" onSubmit={reviewAdjustment} spacing={1.5}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={8}
              label={translate("resources.checkin_admin.adjustment.user_ids")}
              value={adjustmentUserIds}
              onChange={event => setAdjustmentUserIds(event.target.value)}
              error={attemptedReview && userIdsValidation !== null}
              helperText={
                attemptedReview && userIdsValidation
                  ? translate(`resources.checkin_admin.adjustment.validation.${userIdsValidation}`)
                  : translate("resources.checkin_admin.adjustment.user_ids_helper")
              }
            />
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "flex-start" }} gap={1.5}>
              <TextField
                type="number"
                label={translate("resources.checkin_admin.adjustment.amount")}
                value={adjustmentAmount}
                onChange={event => setAdjustmentAmount(event.target.value)}
                error={attemptedReview && amountValidation !== null}
                helperText={
                  attemptedReview && amountValidation
                    ? translate(`resources.checkin_admin.adjustment.validation.${amountValidation}`)
                    : translate("resources.checkin_admin.adjustment.amount_helper")
                }
                slotProps={{ htmlInput: { step: 1 } }}
                sx={{ width: { xs: "100%", sm: 300 } }}
              />
              <Button type="submit" variant="contained" disabled={adjustmentLoading} sx={{ minHeight: 40 }}>
                {translate("resources.checkin_admin.adjustment.review")}
              </Button>
            </Stack>
          </Stack>

          {adjustmentError && (
            <Alert severity="error" role="alert">
              {adjustmentError}
            </Alert>
          )}
          {adjustmentResult && (
            <Alert severity="success" role="status">
              <Stack spacing={1}>
                <Typography>
                  {translate("resources.checkin_admin.adjustment.success", {
                    amount: formatAdjustment(adjustmentResult.amount),
                    count: adjustmentResult.results.length,
                  })}
                </Typography>
                {adjustmentResult.replayed && (
                  <Typography>{translate("resources.checkin_admin.adjustment.replayed")}</Typography>
                )}
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {adjustmentResult.results.map(result => (
                    <Box component="li" key={result.user_id}>
                      <Typography component="span">{result.user_id}</Typography>
                      {`: ${result.previous_points} → ${result.total_points}`}
                    </Box>
                  ))}
                </Box>
              </Stack>
            </Alert>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined">
        <Tabs
          value={view}
          onChange={(_, nextView: CheckinView) => {
            setView(nextView);
            setPage(0);
          }}
          aria-label={translate("resources.checkin_admin.name", { smart_count: 2 })}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value="users" label={translate("resources.checkin_admin.tabs.users")} />
          <Tab value="records" label={translate("resources.checkin_admin.tabs.records")} />
        </Tabs>

        <Stack
          component="form"
          onSubmit={applyFilters}
          direction={{ xs: "column", md: "row" }}
          alignItems={{ md: "center" }}
          gap={1.5}
          sx={{ p: 2, borderTop: 1, borderColor: "divider" }}
        >
          <TextField
            size="small"
            label={translate("resources.checkin_admin.filters.user")}
            value={draftFilters.search}
            onChange={event => setDraftFilters(current => ({ ...current, search: event.target.value }))}
            sx={{ minWidth: { xs: "100%", md: 240 }, flexGrow: 1 }}
          />
          {view === "records" && (
            <>
              <TextField
                size="small"
                type="date"
                label={translate("resources.checkin_admin.filters.from_date")}
                value={draftFilters.fromDate}
                onChange={event => setDraftFilters(current => ({ ...current, fromDate: event.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 160 }}
              />
              <TextField
                size="small"
                type="date"
                label={translate("resources.checkin_admin.filters.to_date")}
                value={draftFilters.toDate}
                onChange={event => setDraftFilters(current => ({ ...current, toDate: event.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
                error={invalidDateRange}
                helperText={
                  invalidDateRange ? translate("resources.checkin_admin.filters.invalid_date_range") : undefined
                }
                sx={{ minWidth: 160 }}
              />
            </>
          )}
          <Stack direction="row" gap={1} sx={{ flexShrink: 0 }}>
            <Button type="submit" variant="contained" disabled={invalidDateRange} sx={{ whiteSpace: "nowrap" }}>
              {translate("resources.checkin_admin.filters.apply")}
            </Button>
            <Button type="button" onClick={resetFilters} sx={{ whiteSpace: "nowrap" }}>
              {translate("resources.checkin_admin.filters.reset")}
            </Button>
          </Stack>
        </Stack>

        {loading && <LinearProgress aria-label="loading" />}
        {failed && (
          <Alert severity="error" sx={{ m: 2 }}>
            {translate("resources.checkin_admin.load_failure")}
          </Alert>
        )}

        <TableContainer sx={{ overflowX: "auto" }}>
          <Table
            size="small"
            aria-label={translate(`resources.checkin_admin.tabs.${view}`)}
            sx={{ minWidth: view === "users" ? 860 : 680 }}
          >
            <TableHead>
              {view === "users" ? (
                <TableRow>
                  <TableCell>{translate("resources.checkin_admin.fields.user_id")}</TableCell>
                  <TableCell align="right">{translate("resources.checkin_admin.fields.total_points")}</TableCell>
                  <TableCell align="right">{translate("resources.checkin_admin.fields.checkin_count")}</TableCell>
                  <TableCell align="right">{translate("resources.checkin_admin.fields.current_streak")}</TableCell>
                  <TableCell align="right">{translate("resources.checkin_admin.fields.longest_streak")}</TableCell>
                  <TableCell>{translate("resources.checkin_admin.fields.last_checkin")}</TableCell>
                  <TableCell />
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell>{translate("resources.checkin_admin.fields.user_id")}</TableCell>
                  <TableCell>{translate("resources.checkin_admin.fields.date")}</TableCell>
                  <TableCell align="right">{translate("resources.checkin_admin.fields.points")}</TableCell>
                  <TableCell>{translate("resources.checkin_admin.fields.awarded_at")}</TableCell>
                </TableRow>
              )}
            </TableHead>
            <TableBody>
              {!loading && !failed && view === "users" && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    {translate("resources.checkin_admin.empty")}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !failed && view === "records" && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    {translate("resources.checkin_admin.empty")}
                  </TableCell>
                </TableRow>
              )}
              {view === "users" &&
                users.map(user => (
                  <TableRow key={user.user_id} hover>
                    <TableCell>{user.user_id}</TableCell>
                    <TableCell align="right">{user.total_points}</TableCell>
                    <TableCell align="right">{user.checkin_count}</TableCell>
                    <TableCell align="right">{user.current_streak}</TableCell>
                    <TableCell align="right">{user.longest_streak}</TableCell>
                    <TableCell>{user.last_checkin}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openUserRecords(user.user_id)}>
                        {translate("resources.checkin_admin.action.view_records")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              {view === "records" &&
                records.map(record => (
                  <TableRow key={`${record.user_id}-${record.date}`} hover>
                    <TableCell>{record.user_id}</TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell align="right">+{record.points}</TableCell>
                    <TableCell>{formatTimestamp(record.awarded_at)}</TableCell>
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

      <Dialog
        open={pendingAdjustment !== null}
        onClose={() => !adjustmentLoading && setPendingAdjustment(null)}
        aria-labelledby="checkin-adjustment-confirm-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="checkin-adjustment-confirm-title">
          {translate("resources.checkin_admin.adjustment.confirm_title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingAdjustment &&
              translate("resources.checkin_admin.adjustment.confirm_body", {
                amount: formatAdjustment(pendingAdjustment.request.amount),
                count: pendingAdjustment.request.user_ids.length,
              })}
          </DialogContentText>
          {pendingAdjustment && (
            <Box
              component="ul"
              aria-label={translate("resources.checkin_admin.adjustment.user_ids")}
              sx={{ maxHeight: 200, overflowY: "auto", pl: 3, mb: 0 }}
            >
              {pendingAdjustment.request.user_ids.map(userId => (
                <Box component="li" key={userId} sx={{ overflowWrap: "anywhere" }}>
                  {userId}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingAdjustment(null)} disabled={adjustmentLoading}>
            {translate("resources.checkin_admin.adjustment.cancel")}
          </Button>
          <Button onClick={() => void applyAdjustment()} variant="contained" disabled={adjustmentLoading}>
            {adjustmentLoading
              ? translate("resources.checkin_admin.adjustment.processing")
              : translate("resources.checkin_admin.adjustment.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CheckinAdminPage;
