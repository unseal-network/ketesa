import { jsonClient } from "../http";
import { StatisticsReport, StatisticsReportQuery } from "../types";

export const STATISTICS_REPORT_PATH = "/_synapse/client/site/v1/statistics/report";

const getStatisticsReportUrl = (query?: StatisticsReportQuery) => {
  const baseUrl = localStorage.getItem("base_url");
  if (!baseUrl) throw new Error("Homeserver not set");
  if (!query?.from && !query?.to) return `${baseUrl}${STATISTICS_REPORT_PATH}`;
  if (!query.from || !query.to) throw new Error("Statistics range must include both dates");
  const params = new URLSearchParams({ from: query.from, to: query.to });
  return `${baseUrl}${STATISTICS_REPORT_PATH}?${params.toString()}`;
};

export const getStatisticsReport = async (query?: StatisticsReportQuery): Promise<StatisticsReport> => {
  const { json } = await jsonClient(getStatisticsReportUrl(query));
  return json as StatisticsReport;
};
