import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useDataProvider, useLocale, useRecordContext, useTranslate } from "react-admin";

import { SynapseDataProvider } from "../../providers/types";

/**
 * Read-only display of the optional phone number a user entered at registration.
 * It is a plain remark (never verified) and deliberately not a form input, so it is
 * never submitted back to Synapse when the user record is saved.
 */
const UserPhoneRemark = () => {
  const record = useRecordContext();
  const translate = useTranslate();
  const locale = useLocale();
  const dataProvider = useDataProvider() as SynapseDataProvider;
  const userId = record?.id ? String(record.id) : undefined;

  const { data, isPending, isError } = useQuery({
    queryKey: ["userPhone", userId],
    queryFn: () => dataProvider.getUserPhone(userId as string),
    enabled: !!userId,
    retry: false,
  });

  if (!userId) return null;

  let value: ReactNode;
  if (isPending) {
    value = null;
  } else if (isError) {
    value = (
      <Typography variant="body2" color="error">
        {translate("resources.users.phone_remark.load_failed")}
      </Typography>
    );
  } else if (data === null) {
    value = (
      <Typography variant="body2" color="text.secondary">
        {translate("resources.users.phone_remark.unavailable")}
      </Typography>
    );
  } else if (data?.phone) {
    value = (
      <>
        <Typography variant="body1" data-testid="user-phone-remark-value">
          {data.phone}
        </Typography>
        {data.updated_at_ms != null && (
          <Typography variant="caption" color="text.secondary">
            {translate("resources.users.phone_remark.updated_at", {
              date: new Date(data.updated_at_ms).toLocaleString(locale),
            })}
          </Typography>
        )}
      </>
    );
  } else {
    value = (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
        {translate("resources.users.phone_remark.not_provided")}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", mb: 2 }}>
      <Typography variant="caption" color="text.secondary" title={translate("resources.users.phone_remark.helper")}>
        {translate("resources.users.phone_remark.label")}
      </Typography>
      {value}
    </Box>
  );
};

export default UserPhoneRemark;
