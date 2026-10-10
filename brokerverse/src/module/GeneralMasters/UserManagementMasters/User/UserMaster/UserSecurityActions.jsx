import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import { Dialog } from "primereact/dialog";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tag } from "primereact/tag";
import userService from "../../../../../services/userService";
import { notifyError, notifySuccess } from "../../../../../utility/dialogs";
import { formatInstant } from "../../../../../utility/dateFormat";
import { openConfirm } from "../../../../../components/ConfirmDialog";
import { humanize } from "../../../../../components/ActivityLog";
import "../../../../../agentModule/authModule/security/security.scss";
import { ADMIN_ROLES } from "../../../../../utils/menuPermissions";
import { copyText } from "../../../../../utility/clipboard";

const PRIVILEGED_ROLES = ADMIN_ROLES;
const readList = (key) => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/**
 * What the signed-in administrator may do to a user account (the server applies the same rules):
 * write:users is required; only a System Administrator may act on a System Administrator account, and nobody changes
 * their own access here (own password: the profile).
 */
export const accountPermissions = (row) => {
  const roles = readList("USER_ROLES");
  const permissions = readList("USER_PERMISSIONS");
  const isAdmin = roles.some((r) => PRIVILEGED_ROLES.includes(r));
  const canWrite = isAdmin || permissions.includes("write:users");
  const targetRoles = row?.fullUserData?.roles || row?.roles || [];
  const privileged = targetRoles.some((r) => PRIVILEGED_ROLES.includes(r));
  const self = String(row?.id) === String(localStorage.getItem("USER_ID") || "");
  return {
    canManage: canWrite && !self && (isAdmin || !privileged),
    canRead: isAdmin || permissions.includes("read:users") || permissions.includes("write:users"),
  };
};

const BROWSERS = [[/Edg\//, "Edge"], [/OPR\/|Opera/, "Opera"], [/Firefox\//, "Firefox"], [/Chrome\//, "Chrome"], [/Safari\//, "Safari"]];
const SYSTEMS = [[/Windows/, "Windows"], [/iPhone|iPad|iOS/, "iOS"], [/Android/, "Android"], [/Mac OS X|Macintosh/, "macOS"], [/Linux/, "Linux"]];

/** "Chrome on Windows" from a user agent; the user agent itself when neither is recognised. */
export const deviceOf = (userAgent) => {
  const ua = String(userAgent || "");
  if (!ua) return "-";
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  if (browser && system) return `${browser} · ${system}`;
  return browser || system || ua.slice(0, 60);
};

/** Temporary password, shown once, with a copy button. */
const TemporaryPasswordDialog = ({ result, onHide }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    setCopied(await copyText(result.temporaryPassword));
  };
  return (
    <Dialog
      header={t("security.temporaryPasswordTitle")}
      visible={!!result}
      onHide={onHide}
      style={{ width: "32rem" }}
      breakpoints={{ "640px": "95vw" }}
      modal
      closable
      footer={<Button label={t("security.doneCopied")} onClick={onHide} />}
    >
      {result && (
        <div className="bv-security__form">
          <p className="bv-security__intro">{t("security.temporaryPasswordIntro", { user: result.username })}</p>
          <div className="bv-security__temp-password">
            <code aria-label={t("security.temporaryPassword")}>{result.temporaryPassword}</code>
            <Button
              type="button"
              icon={copied ? "pi pi-check" : "pi pi-copy"}
              className="p-button-text"
              aria-label={t("security.copyPassword")}
              tooltip={copied ? t("security.copied") : t("security.copyPassword")}
              onClick={copy}
            />
          </div>
          <p className="bv-security__help">{t("security.temporaryPasswordNote")}</p>
        </div>
      )}
    </Dialog>
  );
};
export { TemporaryPasswordDialog };

/** Sign-in history of one user (GET /users/:id/login-history), newest first, paged on the server. */
const LoginHistoryDialog = ({ user, onHide }) => {
  const { t } = useTranslation();
  const [state, setState] = useState({ items: [], total: 0, page: 1, perPage: 10, loading: false });
  const load = useCallback(
    async (page, perPage) => {
      if (!user) return;
      setState((s) => ({ ...s, loading: true }));
      try {
        const r = await userService.getLoginHistory(user.id, { page, perPage });
        setState({ ...r, loading: false });
      } catch (error) {
        setState((s) => ({ ...s, loading: false }));
        notifyError(error);
      }
    },
    [user]
  );
  useEffect(() => {
    if (user) load(1, 10);
  }, [user, load]);

  const reason = (r) => t(`security.reasons.${r.reason}`, { defaultValue: r.reason || "-" });
  return (
    <Dialog
      header={t("security.signInHistoryOf", { user: user?.userName || "" })}
      visible={!!user}
      onHide={onHide}
      style={{ width: "60rem" }}
      breakpoints={{ "960px": "95vw" }}
      modal
    >
      <DataTable
        value={state.items}
        lazy
        paginator
        rows={state.perPage}
        first={(state.page - 1) * state.perPage}
        totalRecords={state.total}
        onPage={(e) => load(e.page + 1, e.rows)}
        rowsPerPageOptions={[10, 20, 50]}
        loading={state.loading}
        emptyMessage={t("security.noSignIns")}
        size="small"
        responsiveLayout="scroll"
        className="bv-security__history"
      >
        <Column header={t("security.when")} body={(r) => formatInstant(r.at)} />
        <Column
          header={t("security.result")}
          body={(r) => <Tag severity={r.success ? "success" : "danger"} value={r.success ? t("security.success") : t("security.failed")} />}
        />
        <Column header={t("security.detail")} body={reason} />
        <Column header={t("security.method")} body={(r) => (r.method ? t(`security.methods.${r.method}`, { defaultValue: humanize(r.method) }) : "-")} />
        <Column header={t("security.ipAddress")} field="ip" />
        <Column header={t("security.device")} body={(r) => <span title={r.userAgent || ""}>{deviceOf(r.userAgent)}</span>} />
      </DataTable>
    </Dialog>
  );
};

/**
 * Row action menu of the User list: Unlock (locked accounts), Reset password (temporary password shown once),
 * Turn off two-factor (lost phone), Sign-in history.
 */
const UserSecurityActions = ({ row, onChanged }) => {
  const { t } = useTranslation();
  const menu = useRef(null);
  const [temp, setTemp] = useState(null);
  const [history, setHistory] = useState(null);
  const { canManage, canRead } = accountPermissions(row);
  const name = row.userName || row.username;
  const status = String(row.status || "").toLowerCase();
  const twoFactorOn = !!(row.twoFactorEnabled ?? row.fullUserData?.twoFactorEnabled);

  const roles = (row.fullUserData?.roles || row.roles || []).map((r) => humanize(r)).join(", ");
  const facts = [
    { label: t("security.user"), value: row.displayName || row.fullUserData?.displayName || name },
    { label: t("security.userName"), value: name },
    { label: t("security.roles"), value: roles, hidden: !roles },
  ];

  // the action runs inside the confirmation, which shows its error and stays open when it fails
  const run = async ({ title, question, note, confirmLabel, severity, action, success }) => {
    let result;
    const done = await openConfirm({
      title,
      severity,
      message: question,
      facts,
      note,
      confirmLabel,
      onConfirm: async () => {
        result = await action();
      },
    });
    if (!done) return undefined;
    if (success) notifySuccess(success);
    onChanged?.();
    return result;
  };

  const items = [
    ...(status === "locked"
      ? [{
          label: t("security.unlock"),
          icon: "pi pi-lock-open",
          disabled: !canManage,
          command: () => run({
            title: t("security.unlockTitle"),
            question: t("security.unlockMessage"),
            confirmLabel: t("security.unlockAction"),
            severity: "neutral",
            action: () => userService.unlockUser(row.id),
            success: t("security.unlocked", { user: name }),
          }),
        }]
      : []),
    {
      label: t("security.resetPassword"),
      icon: "pi pi-key",
      disabled: !canManage || status === "inactive",
      command: async () => {
        const r = await run({
          title: t("security.resetPassword"),
          question: t("security.resetMessage"),
          note: t("security.resetNote"),
          confirmLabel: t("security.resetPassword"),
          severity: "warning",
          action: () => userService.resetUserPassword(row.id),
        });
        if (r?.temporaryPassword) setTemp({ username: name, temporaryPassword: r.temporaryPassword });
      },
    },
    ...(twoFactorOn
      ? [{
          label: t("security.turnOffUser2fa"),
          icon: "pi pi-shield",
          disabled: !canManage,
          command: () => run({
            title: t("security.turnOffUser2fa"),
            question: t("security.turnOff2faMessage"),
            note: t("security.turnOff2faNote"),
            confirmLabel: t("security.turnOffAction"),
            severity: "danger",
            action: () => userService.resetUserTwoFactor(row.id),
            success: t("security.twoFactorReset", { user: name }),
          }),
        }]
      : []),
    { separator: true },
    { label: t("security.signInHistory"), icon: "pi pi-history", disabled: !canRead, command: () => setHistory(row) },
  ];

  return (
    <>
      <Menu model={items} popup ref={menu} id={`user-actions-${row.id}`} />
      <Button
        icon="pi pi-ellipsis-v"
        className="p-button-text p-button-rounded user__actions__btn"
        aria-label={t("security.accountActions", { user: name })}
        aria-haspopup
        aria-controls={`user-actions-${row.id}`}
        tooltip={t("security.accountActionsShort")}
        tooltipOptions={{ position: "top" }}
        onClick={(e) => menu.current.toggle(e)}
      />
      <TemporaryPasswordDialog result={temp} onHide={() => setTemp(null)} />
      <LoginHistoryDialog user={history} onHide={() => setHistory(null)} />
    </>
  );
};

export default UserSecurityActions;
