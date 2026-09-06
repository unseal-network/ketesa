import { TopToolbar, useRecordContext } from "react-admin";

import { AllowCrossSigningButton } from "../../components/users/buttons/AllowCrossSigningButton";
import DeleteUserButton from "../../components/users/buttons/DeleteUserButton";
import { RenewAccountValidityButton } from "../../components/users/buttons/RenewAccountValidityButton";
import { ServerNoticeButton } from "../../components/users/ServerNotices";
import { useIsMAS } from "../../providers/data/mas";
import { isSystemUser } from "../../utils/mxid";
import { UserPreventSelfDelete } from "./List";

/** Existing-user actions deliberately exclude credential and contact mutations. */
export const UserEditActions = () => {
  const record = useRecordContext();
  const isMAS = useIsMAS();
  const ownUserId = localStorage.getItem("user_id");
  let ownUserIsSelected = false;
  let systemUserIsSelected = false;
  if (record && record.id) {
    ownUserIsSelected = record.id === ownUserId;
    systemUserIsSelected = isSystemUser(record.id);
  }

  return (
    <TopToolbar sx={{ flexWrap: "wrap", gap: 0.5, whiteSpace: "normal" }}>
      {!record?.deactivated && !isMAS && <AllowCrossSigningButton />}
      {!record?.deactivated && !isMAS && <RenewAccountValidityButton />}
      {!record?.deactivated && <ServerNoticeButton />}
      {record && record.id && (
        <UserPreventSelfDelete ownUserIsSelected={ownUserIsSelected} systemUserIsSelected={systemUserIsSelected}>
          <DeleteUserButton
            selectedIds={[record.id]}
            confirmTitle="resources.users.helper.erase"
            confirmContent="resources.users.helper.erase_text"
            masIdMap={record.mas_id ? { [String(record.id)]: String(record.mas_id) } : undefined}
          />
        </UserPreventSelfDelete>
      )}
    </TopToolbar>
  );
};
