import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Title, useDataProvider, useTranslate } from "react-admin";

import { useDocTitle } from "../components/hooks/useDocTitle";
import {
  StatisticsGroupCoverage,
  StatisticsMetricCoverage,
  StatisticsReport,
  SynapseDataProvider,
} from "../providers/types";

interface DateRange {
  from: string;
  to: string;
}

const formatDateTime = (value: string, timeZone: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone }).format(parsed);
};

const formatDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { dateStyle: "medium" });
};

const valueLabel = (value: number | null) => (value === null ? "—" : value.toLocaleString());

const metricTotalLabel = (value: number, status: string, translate: (key: string) => string) =>
  status === "unavailable" ? translate("resources.statistics.status.unavailable") : value.toLocaleString();

const statusTone = (status: string) => (status === "complete" ? "success" : status === "partial" ? "warning" : "info");

const initialRange = (): DateRange | null => null;

const metricDefinitions = ["registrations", "sync_activity", "message_activity", "group_activity"] as const;

const StatisticsPage = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider() as SynapseDataProvider;
  const [draftRange, setDraftRange] = useState<DateRange | null>(initialRange);
  const [range, setRange] = useState<DateRange | null>(initialRange);
  const [report, setReport] = useState<StatisticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useDocTitle(translate("resources.statistics.name", { smart_count: 2 }));

  const loadReport = useCallback(
    async (requestedRange: DateRange | null, cancelled?: () => boolean) => {
      setLoading(true);
      setErrorStatus(null);
      setFailed(false);
      try {
        const next = requestedRange
          ? await dataProvider.getStatisticsReport(requestedRange)
          : await dataProvider.getStatisticsReport();
        if (cancelled?.()) return;
        setReport(next);
        setRange({ from: next.from, to: next.to });
        setDraftRange({ from: next.from, to: next.to });
      } catch (error) {
        if (cancelled?.()) return;
        const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : null;
        setErrorStatus(Number.isFinite(status) ? status : null);
        setFailed(true);
      } finally {
        if (!cancelled?.()) setLoading(false);
      }
    },
    [dataProvider]
  );

  useEffect(() => {
    let cancelled = false;
    void loadReport(null, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadReport]);

  const submitRange = (event: FormEvent) => {
    event.preventDefault();
    if (!draftRange?.from || !draftRange.to || draftRange.from >= draftRange.to) return;
    void loadReport(draftRange);
  };

  const dailyRows = useMemo(() => {
    if (!report) return [];
    const sync = new Map(report.sync_activity.daily.map(item => [item.date, item.value]));
    const messages = new Map(report.message_activity.daily.map(item => [item.date, item.value]));
    const registrations = new Map(report.registrations.daily.map(item => [item.date, item.value]));
    const groups = new Map(report.group_activity.daily.map(item => [item.date, item.groups]));
    const unknown = new Map(report.group_activity.daily.map(item => [item.date, item.unknown_rooms]));
    return report.registrations.daily.map(item => ({
      date: item.date,
      registrations: registrations.get(item.date) ?? null,
      sync: sync.get(item.date) ?? null,
      messages: messages.get(item.date) ?? null,
      groups: groups.get(item.date) ?? null,
      unknown: unknown.get(item.date) ?? null,
    }));
  }, [report]);

  const coverageItems: readonly (readonly [string, StatisticsMetricCoverage | StatisticsGroupCoverage])[] = report
    ? [
        [translate("resources.statistics.metrics.registrations.label"), report.coverage.registrations],
        [translate("resources.statistics.metrics.sync_activity.label"), report.coverage.sync],
        [translate("resources.statistics.metrics.message_activity.label"), report.coverage.message],
        [translate("resources.statistics.metrics.group_activity.label"), report.coverage.group],
      ]
    : [];

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1440, mx: "auto" }}>
      <Title title={translate("resources.statistics.name", { smart_count: 2 })} />
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 2.5 }}>
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <AssessmentOutlinedIcon color="action" />
            <Typography variant="h5">{translate("resources.statistics.name", { smart_count: 2 })}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            {translate("resources.statistics.description")}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void loadReport(range)}
          disabled={loading}
          sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
        >
          {translate("resources.statistics.actions.refresh")}
        </Button>
      </Stack>

      <Paper component="form" onSubmit={submitRange} variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} alignItems={{ sm: "flex-end" }}>
          <TextField
            type="date"
            size="small"
            label={translate("resources.statistics.filters.from")}
            value={draftRange?.from || ""}
            onChange={event => setDraftRange(current => ({ from: event.target.value, to: current?.to || "" }))}
            InputLabelProps={{ shrink: true }}
            inputProps={{ "aria-label": translate("resources.statistics.filters.from") }}
          />
          <TextField
            type="date"
            size="small"
            label={translate("resources.statistics.filters.to")}
            value={draftRange?.to || ""}
            onChange={event => setDraftRange(current => ({ from: current?.from || "", to: event.target.value }))}
            InputLabelProps={{ shrink: true }}
            inputProps={{ "aria-label": translate("resources.statistics.filters.to") }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ pb: 1 }}>
            {translate("resources.statistics.filters.half_open")}
          </Typography>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !draftRange?.from || !draftRange?.to || draftRange.from >= draftRange.to}
          >
            {translate("resources.statistics.actions.apply")}
          </Button>
        </Stack>
      </Paper>

      {loading && (
        <Paper variant="outlined" sx={{ p: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress aria-label={translate("resources.statistics.loading")} size={28} />
        </Paper>
      )}

      {!loading && failed && (
        <Alert severity={errorStatus === 401 || errorStatus === 403 ? "warning" : "error"}>
          {errorStatus === 401 || errorStatus === 403
            ? translate("resources.statistics.errors.permission")
            : translate("resources.statistics.errors.load")}
        </Alert>
      )}

      {!loading && !failed && report && (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ mb: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              {translate("resources.statistics.range", { from: report.from, to: report.to, timezone: report.timezone })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {translate("resources.statistics.generated", {
                value: formatDateTime(report.generated_at, report.timezone),
              })}
            </Typography>
          </Stack>
          {!report.dataset_enabled && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {translate("resources.statistics.disabled")}
            </Alert>
          )}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
              gap: 1.5,
              mb: 2,
            }}
          >
            {metricDefinitions.map(metric => {
              const data = report[metric];
              const total = data.total;
              const status = data.status;
              return (
                <Paper key={metric} variant="outlined" sx={{ p: 2, minHeight: 124 }}>
                  <Typography variant="overline" color="text.secondary">
                    {translate(`resources.statistics.metrics.${metric}.label`)}
                  </Typography>
                  <Typography variant="h4" sx={{ fontVariantNumeric: "tabular-nums", mt: 0.25 }}>
                    {metricTotalLabel(total, status, translate)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {translate(`resources.statistics.metrics.${metric}.description`)}
                  </Typography>
                  <Typography variant="caption" display="block" color={`${statusTone(status)}.main`} sx={{ mt: 1 }}>
                    {translate(`resources.statistics.status.${status}`)}
                  </Typography>
                </Paper>
              );
            })}
          </Box>

          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6">{translate("resources.statistics.trend.title")}</Typography>
              <Typography variant="body2" color="text.secondary">
                {translate("resources.statistics.trend.description")}
              </Typography>
            </Box>
            <Divider />
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small" aria-label={translate("resources.statistics.trend.title")} sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{translate("resources.statistics.trend.date")}</TableCell>
                    <TableCell align="right">{translate("resources.statistics.metrics.registrations.label")}</TableCell>
                    <TableCell align="right">{translate("resources.statistics.metrics.sync_activity.label")}</TableCell>
                    <TableCell align="right">
                      {translate("resources.statistics.metrics.message_activity.label")}
                    </TableCell>
                    <TableCell align="right">
                      {translate("resources.statistics.metrics.group_activity.label")}
                    </TableCell>
                    <TableCell align="right">{translate("resources.statistics.trend.unknown")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyRows.map(row => (
                    <TableRow key={row.date}>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell align="right">{valueLabel(row.registrations)}</TableCell>
                      <TableCell align="right">{valueLabel(row.sync)}</TableCell>
                      <TableCell align="right">{valueLabel(row.messages)}</TableCell>
                      <TableCell align="right">{valueLabel(row.groups)}</TableCell>
                      <TableCell align="right">{valueLabel(row.unknown)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">{translate("resources.statistics.coverage.title")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {translate("resources.statistics.coverage.description")}
            </Typography>
            <Stack divider={<Divider flexItem />}>
              {coverageItems.map(([label, coverage]) => (
                <Stack
                  key={label}
                  direction={{ xs: "column", sm: "row" }}
                  gap={1}
                  justifyContent="space-between"
                  sx={{ py: 1 }}
                >
                  <Typography variant="body2">{label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {coverage.start
                      ? `${formatDate(coverage.start)} → ${coverage.end ? formatDate(coverage.end) : "…"}`
                      : translate("resources.statistics.coverage.unavailable")}{" "}
                    · {"status" in coverage ? coverage.status : coverage.integrity}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            {report.group_activity.unknown_total > 0 && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                {translate("resources.statistics.coverage.unknown_rooms", {
                  count: report.group_activity.unknown_total,
                })}
              </Alert>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
};

export default StatisticsPage;
