import SaveIcon from "@mui/icons-material/Save";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import {
  Loading,
  NumberInput,
  SaveButton,
  SimpleForm,
  Title,
  Toolbar,
  useDataProvider,
  useNotify,
  useTranslate,
} from "react-admin";

import { useDocTitle } from "../components/hooks/useDocTitle";
import { CheckinSettings, SynapseDataProvider } from "../providers/types";

const MAX_POINTS_PER_CHECKIN = 1_000_000;
const INVALID_POINTS_ERROR = "resources.checkin_settings.validation.invalid";

const parsePointsPerCheckin = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_POINTS_PER_CHECKIN ? parsed : null;
};

const validatePointsPerCheckin = (value: unknown) => {
  return parsePointsPerCheckin(value) === null ? INVALID_POINTS_ERROR : undefined;
};

const CheckinSettingsToolbar = () => (
  <Toolbar>
    <SaveButton alwaysEnable label="resources.checkin_settings.action.save" icon={<SaveIcon />} />
  </Toolbar>
);

const CheckinSettingsPage = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider() as SynapseDataProvider;
  const [settings, setSettings] = useState<CheckinSettings | undefined | null>(undefined);

  useDocTitle(translate("resources.checkin_settings.name", { smart_count: 1 }));

  const fetchSettings = useCallback(async () => {
    try {
      setSettings(await dataProvider.getCheckinSettings());
    } catch {
      setSettings(null);
      notify("resources.checkin_settings.action.load_failure", { type: "error" });
    }
  }, [dataProvider, notify]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    const pointsPerCheckin = parsePointsPerCheckin(data.points_per_checkin);
    if (pointsPerCheckin === null) return;

    try {
      await dataProvider.setCheckinSettings({ points_per_checkin: pointsPerCheckin });
      await fetchSettings();
      notify("resources.checkin_settings.action.save_success");
    } catch {
      notify("resources.checkin_settings.action.save_failure", { type: "error" });
    }
  };

  if (settings === undefined) return <Loading />;

  return (
    <Box sx={{ p: 2 }}>
      <Title title={translate("resources.checkin_settings.name", { smart_count: 1 })} />
      {settings === null ? (
        <Typography color="error">{translate("resources.checkin_settings.action.load_failure")}</Typography>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h5" sx={{ mb: 1 }}>
              {translate("resources.checkin_settings.name", { smart_count: 1 })}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {translate("resources.checkin_settings.description")}
            </Typography>
            <SimpleForm record={settings} onSubmit={handleSubmit} toolbar={<CheckinSettingsToolbar />}>
              <Stack spacing={1} alignItems="flex-start">
                <NumberInput
                  source="points_per_checkin"
                  label="resources.checkin_settings.fields.points_per_checkin"
                  helperText="resources.checkin_settings.fields.points_per_checkin_helper"
                  min={0}
                  max={MAX_POINTS_PER_CHECKIN}
                  step={1}
                  validate={validatePointsPerCheckin}
                />
              </Stack>
            </SimpleForm>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CheckinSettingsPage;
