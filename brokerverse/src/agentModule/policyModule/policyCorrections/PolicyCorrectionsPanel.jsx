import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import policyService from "../../../services/policyService";
import quotationService from "../../../services/quotationService";
import { hasPermission } from "../../../utils/canOpen";
import { notifyError, notifySuccess } from "../../../utility/dialogs";
import { openConfirm } from "../../../components/ConfirmDialog";
import DetailSection from "../../../components/DetailSection";
import DetailDialog from "../../../components/DetailDialog";
import DateField from "../../../components/DateField";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../../components/ReasonPicker";
import ApprovalActions, { isInitiator } from "../../../components/ApprovalActions";
import StatusChip from "../../../components/StatusChip";
import FieldError from "../../../components/FieldError";
import { formatValue } from "../../../components/KeyValueGrid/formatValue";

const EMPTY = { policyNumber: "", insuredName: "", inception: "", expiry: "", insuranceCompanyId: null, insurerReference: "" };
const CORRECTABLE = ["Active", "Expired", "Renewed", "Suspended"];

/** The current values of the policy as the correction form starts from them. */
const startOf = (policy) => ({
  policyNumber: policy?.policyNumber || "",
  insuredName: policy?.insuredName || "",
  inception: policy?.inception || policy?.inceptionDate || "",
  expiry: policy?.expiry || policy?.expiryDate || "",
  insuranceCompanyId: policy?.insuranceCompanyId ?? null,
  insurerReference: "",
});

/**
 * Corrections of the core data of an issued policy (TIS-BRD-ISSUE-04): the policy number, insured name, period and
 * insurer are changed by a correction with a coded reason and, for the insurer's data, the insurer's reference; a
 * second user holding approve:policies approves (applies) or rejects it.
 */
const PolicyCorrectionsPanel = ({ policy, onChanged }) => {
  const { t } = useTranslation();
  const policyId = policy?.policyId || policy?.id;
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [insurers, setInsurers] = useState([]);

  const load = useCallback(async () => {
    if (!policyId) return;
    try {
      setRows(await policyService.getPolicyCorrections(policyId));
    } catch (e) {
      notifyError(e.message);
    }
  }, [policyId]);

  useEffect(() => {
    load();
  }, [load]);

  const canRequest = hasPermission("write:policies") && CORRECTABLE.includes(policy?.status) && !rows.some((r) => r.status === "pending");
  if (!policyId || (!rows.length && !canRequest)) return null;

  const start = async () => {
    setForm(startOf(policy));
    setReason(null);
    setTried(false);
    setError(null);
    setOpen(true);
    if (!insurers.length) {
      try {
        setInsurers(((await quotationService.getInsuranceCompanyOptions()) || []).map((o) => ({ label: o.label, value: Number(o.id ?? o.value) })));
      } catch (e) {
        notifyError(e.message);
      }
    }
  };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target ? e.target.value : e.value }));

  const submit = async () => {
    setTried(true);
    if (reasonProblem(reason)) return;
    const was = startOf(policy);
    const changes = Object.fromEntries(["policyNumber", "insuredName", "inception", "expiry", "insuranceCompanyId"]
      .filter((k) => String(form[k] ?? "") !== String(was[k] ?? ""))
      .map((k) => [k, form[k]]));
    if (!Object.keys(changes).length) {
      setError(t("policyCorrections.nothingChanged"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await policyService.requestPolicyCorrection(policyId, { changes, ...reasonPayload(reason), insurerReference: form.insurerReference.trim() || null });
      notifySuccess(t("policyCorrections.requested"));
      setOpen(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const facts = (r) => r.changes.map((c) => ({ label: c.label, value: `${c.fromText || "—"} → ${c.toText || "—"}` }));
  const approve = async (r) => {
    const done = await openConfirm({
      title: t("policyCorrections.approveTitle"), message: t("policyCorrections.approveMessage"),
      facts: [...facts(r), { label: t("policyCorrections.insurerReference"), value: r.insurerReference }],
      confirmLabel: t("policyCorrections.approve"),
      onConfirm: () => policyService.decidePolicyCorrection(policyId, r.id, "approve"),
    });
    if (!done) return;
    notifySuccess(t("policyCorrections.approved"));
    load();
    onChanged?.();
  };
  const reject = async (r) => {
    const done = await openConfirm({
      title: t("policyCorrections.rejectTitle"), severity: "danger", facts: facts(r), reason: { context: "policy_correction_reject" },
      confirmLabel: t("policyCorrections.reject"),
      onConfirm: (why) => policyService.decidePolicyCorrection(policyId, r.id, "reject", why),
    });
    if (!done) return;
    notifySuccess(t("policyCorrections.rejected"));
    load();
  };
  const withdraw = async (r) => {
    const done = await openConfirm({
      title: t("policyCorrections.withdrawTitle"), facts: facts(r), confirmLabel: t("policyCorrections.withdraw"),
      onConfirm: () => policyService.decidePolicyCorrection(policyId, r.id, "withdraw"),
    });
    if (done) load();
  };

  const decision = (r) => {
    if (r.status !== "pending") return formatValue(r.decidedBy ? `${r.decidedBy}, ${formatValue(r.decidedAt, { type: "datetime" })}` : null, {});
    if (isInitiator({ id: r.requestedById })) {
      return <Button type="button" label={t("policyCorrections.withdraw")} text size="small" onClick={() => withdraw(r)} />;
    }
    if (!hasPermission("approve:policies")) return formatValue(null, {});
    return <ApprovalActions initiator={{ id: r.requestedById }} size="small" approveLabel={t("policyCorrections.approve")} rejectLabel={t("policyCorrections.reject")}
      onApprove={() => approve(r)} onReject={() => reject(r)} />;
  };

  return (
    <DetailSection title={t("policyCorrections.title")} flush={rows.length > 0}
      actions={canRequest ? <Button label={t("policyCorrections.request")} icon="pi pi-pencil" size="small" outlined onClick={start} /> : null}>
      {rows.length ? (
        <DataTable value={rows} dataKey="id" size="small">
          <Column header={t("policyCorrections.requestedAt")} body={(r) => formatValue(r.requestedAt, { type: "datetime" })} />
          <Column header={t("policyCorrections.changes")} body={(r) => (
            <ul className="m-0 pl-3">{r.changes.map((c) => <li key={c.field}>{`${c.label}: ${c.fromText || "—"} → ${c.toText || "—"}`}</li>)}</ul>
          )} />
          <Column header={t("policyCorrections.reason")} body={(r) => r.decisionReason ? `${r.reason} / ${r.decisionReason}` : r.reason} />
          <Column header={t("policyCorrections.insurerReference")} body={(r) => formatValue(r.insurerReference, {})} />
          <Column header={t("policyCorrections.requestedBy")} field="requestedBy" />
          <Column header={t("policyCorrections.status")} body={(r) => <StatusChip code={r.status} label={r.statusLabel} />} />
          <Column header={t("policyCorrections.decision")} body={decision} />
        </DataTable>
      ) : null}
      <DetailDialog visible={open} onHide={() => setOpen(false)} size="md" header={t("policyCorrections.requestTitle")}
        footer={(
          <>
            <Button type="button" label={t("policyCorrections.cancel")} text disabled={busy} onClick={() => setOpen(false)} />
            <Button type="button" label={t("policyCorrections.submit")} loading={busy} onClick={submit} />
          </>
        )}>
        <div className="p-fluid formgrid grid">
          <div className="field col-12 md:col-6">
            <label htmlFor="pcr-number">{t("policyCorrections.policyNumber")}</label>
            <InputText id="pcr-number" value={form.policyNumber} onChange={set("policyNumber")} />
          </div>
          <div className="field col-12 md:col-6">
            <label htmlFor="pcr-insured">{t("policyCorrections.insuredName")}</label>
            <InputText id="pcr-insured" value={form.insuredName} onChange={set("insuredName")} />
          </div>
          <div className="field col-12 md:col-6">
            <label htmlFor="pcr-inception">{t("policyCorrections.inception")}</label>
            <DateField id="pcr-inception" value={form.inception} onChange={set("inception")} />
          </div>
          <div className="field col-12 md:col-6">
            <label htmlFor="pcr-expiry">{t("policyCorrections.expiry")}</label>
            <DateField id="pcr-expiry" value={form.expiry} onChange={set("expiry")} min={form.inception || undefined} />
          </div>
          <div className="field col-12 md:col-6">
            <label htmlFor="pcr-insurer">{t("policyCorrections.insurer")}</label>
            <Dropdown inputId="pcr-insurer" value={form.insuranceCompanyId} options={insurers} onChange={set("insuranceCompanyId")} filter />
          </div>
          <div className="field col-12 md:col-6">
            <label htmlFor="pcr-ref">{t("policyCorrections.insurerReference")}</label>
            <InputText id="pcr-ref" value={form.insurerReference} onChange={set("insurerReference")} />
          </div>
          <div className="field col-12">
            <ReasonPicker context="policy_correction" value={reason} onChange={setReason} showErrors={tried} label={t("policyCorrections.reason")} />
          </div>
        </div>
        <FieldError error={error} />
      </DetailDialog>
    </DetailSection>
  );
};

PolicyCorrectionsPanel.propTypes = { policy: PropTypes.object, onChanged: PropTypes.func };
PolicyCorrectionsPanel.defaultProps = { policy: null, onChanged: null };

export default PolicyCorrectionsPanel;
