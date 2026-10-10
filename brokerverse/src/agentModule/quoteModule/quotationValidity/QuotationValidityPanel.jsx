import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import quotationService from "../../../services/quotationService";
import { hasPermission } from "../../../utils/canOpen";
import { notifyError, notifySuccess } from "../../../utility/dialogs";
import { openConfirm } from "../../../components/ConfirmDialog";
import DetailSection from "../../../components/DetailSection";
import DetailDialog from "../../../components/DetailDialog";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import RowActions from "../../../components/RowActions";
import { formatValue } from "../../../components/KeyValueGrid/formatValue";

const amount = (v, currency) => formatValue(v, { type: "amount", currency });
const date = (v) => formatValue(v, { type: "date" });

/** Validity state of a quotation as a status chip: expired, or the days left. */
const ValidityChip = ({ validity }) => {
  const { t } = useTranslation();
  if (validity.expired) return <StatusChip code="expired" label={t("quotationValidity.expired")} />;
  return <StatusChip code={validity.daysLeft <= 5 ? "pending" : "active"} label={t("quotationValidity.daysLeft", { count: validity.daysLeft })} />;
};
ValidityChip.propTypes = { validity: PropTypes.object.isRequired };

/**
 * Validity and versions of a quotation (QUOT-04): the issue date, the last valid day, the longest validity and the
 * extension, with Extend validity for a user holding extend:quotations; the versions the quotation went through, each
 * superseded version readable as it was.
 */
const QuotationValidityPanel = ({ quotation, onChanged }) => {
  const { t } = useTranslation();
  const [versions, setVersions] = useState([]);
  const [viewed, setViewed] = useState(null);
  const validity = quotation?.validity;
  const id = quotation?.quotationId;
  const version = quotation?.version;

  const loadVersions = useCallback(async () => {
    if (!id) return;
    try {
      setVersions((await quotationService.getQuotationVersions(id)).versions || []);
    } catch (e) {
      notifyError(e.message);
    }
  }, [id]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions, version]);

  if (!validity) return null;

  const extend = async () => {
    const done = await openConfirm({
      title: t("quotationValidity.extendTitle"),
      message: t("quotationValidity.extendMessage", { days: validity.extensionDays }),
      facts: [
        { label: t("quotationValidity.quotation"), value: quotation.quotationNumber },
        { label: t("quotationValidity.validUntil"), value: validity.validUntil, type: "date" },
        { label: t("quotationValidity.latestValidUntil"), value: validity.latestValidUntil, type: "date" },
      ],
      input: { type: "textarea", label: t("quotationValidity.remarks"), required: false },
      confirmLabel: t("quotationValidity.extend"),
      onConfirm: (remarks) => quotationService.extendQuotation(id, remarks),
    });
    if (done === null) return;
    notifySuccess(t("quotationValidity.extended"));
    onChanged?.();
  };

  const view = async (row) => {
    try {
      setViewed(await quotationService.getQuotationVersion(id, row.version));
    } catch (e) {
      notifyError(e.message);
    }
  };

  const canExtend = validity.extendable && hasPermission("extend:quotations");
  return (
    <DetailSection className="mt-3" title={t("quotationValidity.title")}
      actions={canExtend ? <Button label={t("quotationValidity.extend")} icon="pi pi-calendar-plus" size="small" outlined onClick={extend} /> : null}>
      <KeyValueGrid columns={4} items={[
        { label: t("quotationValidity.version"), value: `v${quotation.version || 1}` },
        { label: t("quotationValidity.issuedOn"), value: validity.issuedOn, type: "date" },
        { label: t("quotationValidity.validUntil"), value: validity.validUntil, type: "date" },
        { label: t("quotationValidity.state"), value: <ValidityChip validity={validity} /> },
        { label: t("quotationValidity.latestValidUntil"), value: validity.latestValidUntil, type: "date" },
        { label: t("quotationValidity.extendedAt"), value: validity.extendedAt, type: "datetime", hidden: !validity.extendedAt },
        { label: t("quotationValidity.extendedBy"), value: validity.extendedBy, hidden: !validity.extendedAt },
        { label: t("quotationValidity.remarks"), value: validity.extensionRemarks, span: "full", hidden: !validity.extensionRemarks },
      ]} />
      {versions.length > 1 ? (
        <DataTable value={versions} dataKey="version" size="small" className="mt-3">
          <Column header={t("quotationValidity.version")} body={(r) => `v${r.version}${r.current ? ` (${t("quotationValidity.current")})` : ""}`} />
          <Column header={t("quotationValidity.status")} body={(r) => <StatusChip label={r.status} />} />
          <Column header={t("quotationValidity.grossPremium")} body={(r) => amount(r.grossPremium, r.currency)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("quotationValidity.validUntil")} body={(r) => date(r.validUntil)} />
          <Column header={t("quotationValidity.supersededAt")} body={(r) => formatValue(r.supersededAt, { type: "datetime" })} />
          <Column header={t("quotationValidity.supersededBy")} body={(r) => r.supersededBy || formatValue(null, {})} />
          <Column header={t("quotationValidity.changeReason")} body={(r) => r.changeReason || formatValue(null, {})} />
          <Column header={t("common.actions", "Actions")} body={(r) => (r.current ? null : <RowActions onView={() => view(r)} />)} />
        </DataTable>
      ) : null}
      <DetailDialog visible={Boolean(viewed)} onHide={() => setViewed(null)} size="md"
        header={viewed ? t("quotationValidity.versionTitle", { number: viewed.quotationNumber, version: viewed.version }) : ""}>
        {viewed ? (
          <KeyValueGrid columns={2} items={[
            { label: t("quotationValidity.status"), value: <StatusChip label={viewed.quotationStatus} /> },
            { label: t("quotationValidity.insurer"), value: viewed.insuranceCompanyName },
            { label: t("quotationValidity.sumInsured"), value: viewed.totalSumInsured, type: "amount", currency: viewed.currency },
            { label: t("quotationValidity.netPremium"), value: viewed.netPremium, type: "amount", currency: viewed.currency },
            { label: t("quotationValidity.discount"), value: viewed.discount, type: "amount", currency: viewed.currency },
            { label: t("quotationValidity.grossPremium"), value: viewed.grossPremium, type: "amount", currency: viewed.currency },
            { label: t("quotationValidity.validUntil"), value: viewed.validUntil, type: "date" },
            { label: t("quotationValidity.supersededAt"), value: viewed.supersededAt, type: "datetime" },
            { label: t("quotationValidity.changeReason"), value: viewed.changeReason, span: "full" },
          ]} />
        ) : null}
      </DetailDialog>
    </DetailSection>
  );
};

QuotationValidityPanel.propTypes = { quotation: PropTypes.object, onChanged: PropTypes.func };
QuotationValidityPanel.defaultProps = { quotation: null, onChanged: null };

export default QuotationValidityPanel;
