import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import accessControlService from "../../services/accessControlService";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { ChangeLines } from "./AuthorityPendingTab";
import { useLabels } from "./common";

/** A checked line of the upload as the API takes it. */
const sendable = (l) => ({
  transactionType: l.transactionType, roleCode: l.roleCode || undefined, userId: l.userId || undefined, maxAmount: l.unlimited ? null : l.maxAmount, unlimited: !!l.unlimited,
  effectiveFrom: l.effectiveFrom, referenceNo: l.referenceNo || undefined, referenceDate: l.referenceDate || undefined, remarks: l.remarks || undefined,
});

/**
 * Side panel "Review upload": the changes a checked workbook makes (in effect, new value, effective date, reference),
 * how many rows are unchanged, remarks for the approver. Submit sends them for approval as one change; Discard drops
 * them (nothing was saved).
 */
const AuthorityUploadReview = ({ result, onHide, onSubmitted }) => {
  const k = useLabels();
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setRemarks(""), [result]);

  const submit = async () => {
    setSaving(true);
    try {
      const r = await accessControlService.proposeAuthorityChange({ lines: result.changes.map(sendable), file: result.file, rowsRead: result.rowsRead,
        unchanged: result.unchanged, remarks: remarks.trim() || undefined });
      notifySuccess(r.message);
      await onSubmitted(r.data);
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <Button label={k("authority.discard", "Discard")} text onClick={onHide} disabled={saving} />
      <Button label={k("submitForApproval", "Submit for approval")} icon="pi pi-send" onClick={submit} loading={saving} />
    </>
  );
  return (
    <Dialog visible={!!result} onHide={onHide} modal className="am-panel am-panel--wide" style={{ width: "56rem" }} footer={footer}
      header={(
        <div className="am-panel__title">
          <span>{k("authority.reviewUpload", "Review upload")}</span>
          {result?.file ? <span className="am-panel__subtitle">{result.file.name}</span> : null}
        </div>
      )}>
      {result ? (
        <div className="am-panel__body">
          <div className="rp-chips">
            <Tag severity="warning" value={k("authority.changesCount", "{{count}} changes", { count: result.changes.length })} />
            <Tag severity="secondary" value={k("authority.unchangedCount", "{{count}} unchanged", { count: result.unchanged })} />
          </div>
          <ChangeLines lines={result.changes} />
          <div className="admin__field">
            <label htmlFor="am-upload-remarks">{k("authority.remarksForApprover", "Remarks for the approver")} <span className="rp-muted">{k("authority.optional", "(optional)")}</span></label>
            <InputTextarea id="am-upload-remarks" rows={2} maxLength={1000} autoResize value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
      ) : null}
    </Dialog>
  );
};

AuthorityUploadReview.propTypes = { result: PropTypes.object, onHide: PropTypes.func.isRequired, onSubmitted: PropTypes.func.isRequired };

export default AuthorityUploadReview;
