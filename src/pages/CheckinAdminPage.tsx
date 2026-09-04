import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import {
  Alert,
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
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Title, useDataProvider, useTranslate } from "react-admin";
import { useNavigate } from "react-router-dom";

import { useDocTitle } from "../components/hooks/useDocTitle";
import { CheckinRecord, CheckinUserSummary, SynapseDataProvider } from "../providers/types";

type CheckinView = "users" | "records";

interface CheckinFilters {
  search: string;
  fromDate: string;
  toDate: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const INITIAL_FILTERS: CheckinFilters = { search: "", fromDate: "", toDate: "" };

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
  }, [dataProvider, query, view]);

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
    </Box>
  );
};

export default CheckinAdminPage;
