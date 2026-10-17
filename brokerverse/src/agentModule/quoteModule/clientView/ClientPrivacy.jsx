import React, { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import DialogFooter from "../../../components/DialogFooter";
import KeyValueGrid from "../../../components/KeyValueGrid";
import { SectionCard } from "../../../components/RecordPage";
import StatusChip from "../../../components/StatusChip";
import clientService from "../../../services/clientService";
import { formatDate } from "../../../utility/dateFormat";
import { notifyError } from "../../../utility/dialogs";
import { hasPermission } from "../../../utils/canOpen";

const consentKey = (v) => (v === true ? "given" : v === false ? "refused" : "notRecorded");

/**
 * Privacy of a client (TIS-BRD-NFR-17.1): the privacy notice acknowledged (date and version), the marketing consent and
 * the e-mail opt-out. A client who opted out or refused consent receives no marketing e-mail; policy, billing, renewal
 * and claim e-mails are still sent.
 */
const ClientPrivacy = ({ client, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const canEdit = hasPermission("write:clients");
  const consent = consentKey(client.marketingConsent);

  const save = async () => {
    setSaving(true);
    const r = await clientService.updateClient(client.id || client.clientId, form);
    setSaving(false);
    if (!r.success) {
      notifyError(r.error);
      return;
    }
    setForm(null);
    onSaved();
  };

  return (
    <SectionCard title={t("clientPrivacy.title")} hint={t("clientPrivacy.help")}
      actions={canEdit ? <Button type="button" icon="pi pi-pencil" outlined label={t("clientPrivacy.edit")}
        onClick={() => setForm({ privacyNoticeAcknowledged: !!client.privacyNoticeAcknowledged, marketingConsent: client.marketingConsent ?? null, emailOptOut: !!client.emailOptOut })} /> : null}>
      <KeyValueGrid columns={3} items={[
        { key: "notice", label: t("clientPrivacy.notice"), value: client.privacyNoticeAcknowledged
          ? t("clientPrivacy.acknowledgedOn", { date: formatDate(client.privacyNoticeAcknowledgedAt), version: client.privacyNoticeVersion || "-" })
          : <StatusChip label={t("clientPrivacy.notAcknowledged")} severity="warning" /> },
        { key: "consent", label: t("clientPrivacy.marketingConsent"), value: (
          <StatusChip label={t(`clientPrivacy.consent.${consent}`)} severity={consent === "given" ? "success" : consent === "refused" ? "danger" : "secondary"} />
        ) },
        { key: "optOut", label: t("clientPrivacy.marketingEmail"), value: client.emailOptOut
          ? t("clientPrivacy.optedOutOn", { date: formatDate(client.emailOptOutAt) }) : t("clientPrivacy.receives") },
      ]} />
      <Dialog visible={!!form} onHide={() => setForm(null)} header={t("clientPrivacy.editTitle")} style={{ width: "30rem" }}
        footer={<DialogFooter onClose={() => setForm(null)} closeLabel={t("common.cancel", "Cancel")} primary={{ label: t("clientPrivacy.save"), icon: "pi pi-check", onClick: save, loading: saving }} />}>
        {form ? (
          <div className="client-privacy__form">
            <div className="client-privacy__row">
              <InputSwitch inputId="cp-notice" checked={form.privacyNoticeAcknowledged} onChange={(e) => setForm({ ...form, privacyNoticeAcknowledged: !!e.value })} />
              <label htmlFor="cp-notice">{t("clientPrivacy.noticeAcknowledged")}</label>
            </div>
            <label htmlFor="cp-consent">{t("clientPrivacy.marketingConsent")}</label>
            <Dropdown inputId="cp-consent" value={consentKey(form.marketingConsent)}
              options={["given", "refused", "notRecorded"].map((k) => ({ label: t(`clientPrivacy.consent.${k}`), value: k }))}
              onChange={(e) => setForm({ ...form, marketingConsent: e.value === "given" ? true : e.value === "refused" ? false : null })} />
            <div className="client-privacy__row">
              <InputSwitch inputId="cp-optout" checked={form.emailOptOut} onChange={(e) => setForm({ ...form, emailOptOut: !!e.value })} />
              <label htmlFor="cp-optout">{t("clientPrivacy.optOut")}</label>
            </div>
            <p className="client-privacy__note">{t("clientPrivacy.transactionalNote")}</p>
          </div>
        ) : null}
      </Dialog>
    </SectionCard>
  );
};

ClientPrivacy.propTypes = {
  client: PropTypes.shape({
    id: PropTypes.string, clientId: PropTypes.string, privacyNoticeAcknowledged: PropTypes.bool, privacyNoticeAcknowledgedAt: PropTypes.string,
    privacyNoticeVersion: PropTypes.string, marketingConsent: PropTypes.bool, emailOptOut: PropTypes.bool, emailOptOutAt: PropTypes.string,
  }).isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default ClientPrivacy;
