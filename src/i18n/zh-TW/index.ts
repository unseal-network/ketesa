import zh from "../zh";

// Locale modules are intentionally permissive maps because react-admin adds
// its catalogue at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zhMessages = zh as any;

// Most of the long lived Ketesa catalogue is shared with zh. Keep the locale
// available with a complete fallback while giving the new security surface its
// native Traditional Chinese copy.
const traditional = {
  ...zh,
  ketesa: {
    ...zhMessages.ketesa,
    auth: {
      ...zhMessages.ketesa.auth,
      admin2fa: {
        ...zhMessages.ketesa.auth.admin2fa,
        label: "管理員登入",
        description: "先輸入使用者名稱。管理員存取必須同時驗證密碼和驗證器代碼。",
        continue: "繼續",
        enroll_title: "設定驗證器",
        verify_title: "驗證登入",
        scan_hint: "使用驗證器應用程式掃描 QR 碼，然後輸入六位數代碼。",
        code: "驗證器代碼",
        sign_in: "驗證並登入",
        use_different_account: "使用其他帳戶",
        security_note: "密鑰只會在設定期間顯示，不會儲存到此瀏覽器。",
        invalid: "無法驗證這些資料，請檢查密碼和代碼後重試。",
      },
    },
    security: {
      ...zhMessages.ketesa.security,
      menu_label: "帳戶安全性",
      title: "帳戶安全性",
      description: "管理可用於確認管理員登入的驗證器應用程式。",
      factors: "驗證器應用程式",
      none: "尚未設定驗證器。",
      add_title: "新增驗證器",
      add: "新增驗證器",
      name: "名稱",
      authenticator_default: "驗證器應用程式",
      confirm_title: "確認新的驗證器",
      scan_hint: "使用驗證器應用程式掃描 QR 碼，然後輸入目前代碼以啟用。",
      remove_title: "移除驗證器",
      remove_description: "請輸入將保留的其他驗證器目前代碼。",
      last_factor_disabled: "至少必須保留一個驗證器。",
      added: "驗證器已新增",
      removed: "驗證器已移除",
      invalid_code: "代碼無效，請輸入驗證器中的目前代碼。",
      request_failed: "要求未完成，請重試。",
      load_failed: "無法載入驗證器，請重試。",
    },
  },
};

export default traditional;
