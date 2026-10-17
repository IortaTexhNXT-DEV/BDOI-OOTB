import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputSwitch } from "primereact/inputswitch";
import periodEndService from "../../../services/periodEndService";

/**
 * Period Management > Finance Controls (GAP-FIN-05): the maker-checker and posting controls of Finance. Only a holder
 * of approve:period-end changes them (the server says so per row in canChange); IT AppSupport sees them on Master >
 * Configuration but cannot switch them. A list-valued control (the parked events) is shown as text.
 */
const FinanceControls = ({ onHide, onSaved, onError }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    periodEndService.financeControls().then(setRows).catch((e) => { onError?.(e); setRows([]); });
  }, [onError]);

  const canChange = !!rows?.some((r) => r.canChange);
  const changed = Object.keys(draft).filter((k) => rows?.find((r) => r.key === k)?.value !== draft[k]);
  const save = async () => {
    setBusy(true);
    try {
      setRows(await periodEndService.saveFinanceControls(Object.fromEntries(changed.map((k) => [k, draft[k]]))));
      setDraft({});
      onSaved?.();
    } catch (e) {
      onError?.(e);
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <div>
      <Button type="button" label={t("periodEnd.cancel")} text onClick={onHide} disabled={busy} />
      {canChange && <Button type="button" label={t("periodManagement.financeControls.save")} icon="pi pi-check" loading={busy} disabled={!changed.length} onClick={save} />}
    </div>
  );
  return (
    <Dialog className="pe-dialog" visible onHide={onHide} footer={footer} style={{ width: "min(640px, 96vw)" }} draggable={false}
      header={t("periodManagement.financeControls.title")}>
      <p className="pm-controls__hint">{t(canChange ? "periodManagement.financeControls.help" : "periodManagement.financeControls.readOnly")}</p>
      <ul className="pm-controls" aria-label={t("periodManagement.financeControls.title")}>
        {(rows || []).map((r) => {
          const value = draft[r.key] ?? r.value;
          return (
            <li key={r.key} className="pm-controls__row">
              <label htmlFor={`fc-${r.key}`}>
                <span>{r.label}</span>
                <small>{r.key}</small>
              </label>
              {r.type === "boolean" ? (
                <InputSwitch inputId={`fc-${r.key}`} checked={value === true} disabled={!r.canChange || busy}
                  onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.value }))} />
              ) : (
                <span id={`fc-${r.key}`} className="pm-controls__text">{Array.isArray(value) ? value.join(", ") : String(value)}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
};

export default FinanceControls;
