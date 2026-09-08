export interface StatisticsDailyValue {
  date: string;
  value: number | null;
}

export interface StatisticsGroupDailyValue {
  date: string;
  groups: number | null;
  unknown_rooms: number | null;
}

export interface StatisticsMetricCoverage {
  start: string | null;
  end: string | null;
  integrity: string;
  sources: Record<string, string | null>;
}

export interface StatisticsGroupCoverage {
  start: string | null;
  end: string | null;
  status: string;
  sources: Record<string, string | null>;
}

export interface StatisticsReport {
  from: string;
  to: string;
  generated_at: string;
  timezone: string;
  definition_version: number;
  dataset_enabled: boolean;
  coverage: {
    registrations: StatisticsMetricCoverage;
    sync: StatisticsMetricCoverage;
    message: StatisticsMetricCoverage;
    group: StatisticsGroupCoverage;
  };
  registrations: { total: number; status: string; daily: StatisticsDailyValue[] };
  sync_activity: { total: number; status: string; daily: StatisticsDailyValue[] };
  message_activity: { total: number; status: string; daily: StatisticsDailyValue[] };
  group_activity: {
    total: number;
    unknown_total: number;
    status: string;
    daily: StatisticsGroupDailyValue[];
  };
}

export interface StatisticsReportQuery {
  from?: string;
  to?: string;
}
