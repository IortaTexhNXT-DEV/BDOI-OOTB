import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import S3FileUpload from "../../../components/S3FileUpload";
import { receiptsService } from "../../../services/receiptsService";
import { hasPermission } from "../../../utils/canOpen";
import { showErrorMessage, showSuccessMessage } from "../../../utility/toastUtils";

/**
 * Proof of payment of a receipt (deposit slip, transfer confirmation, cheque copy): shown with a link once attached;
 * a collection user attaches it while the receipt is not cancelled. A remittance run on the fully paid basis remits a
 * policy only when each of its receipts carries a proof.
 */
const ReceiptProof = ({ receiptId, proof, collectedBy, cancelled }) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(proof);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setCurrent(proof), [proof]);
  const canAttach = hasPermission("write:receipts") && !cancelled;

  const attach = async () => {
    setBusy(true);
    try {
      const r = await receiptsService.attachProof(receiptId, { proofKey: file.url, proofFileName: file.name });
      setCurrent(r?.proof || { key: file.url, fileName: file.name });
      setFile(null);
      showSuccessMessage(t("accounts.receiptProof.attached"));
    } catch (e) {
      showErrorMessage(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailSection title={t("accounts.receiptProof.title")} className="mt-4">
      <KeyValueGrid columns={3} items={[
        { label: t("accounts.receiptProof.file"), value: current ? <a href={current.key} target="_blank" rel="noopener noreferrer">{current.fileName || t("accounts.receiptProof.open")}</a> : null },
        { label: t("accounts.receiptProof.collectedBy"), value: collectedBy?.name, hidden: !collectedBy },
        { label: t("accounts.receiptProof.partnerReference"), value: collectedBy?.reference, hidden: !collectedBy },
      ]} />
      {canAttach ? (
        <div className="flex flex-wrap align-items-end gap-2 mt-3">
          <S3FileUpload accept=".pdf,.png,.jpg,.jpeg" maxFileSize={10 * 1024 * 1024} multiple={false} autoUpload uploadPath="receipts"
            onUploadSuccess={(url, f) => setFile({ url, name: f?.name || "" })} onRemove={() => setFile(null)} />
          <Button label={current ? t("accounts.receiptProof.replace") : t("accounts.receiptProof.attach")} icon="pi pi-paperclip" disabled={!file || busy} loading={busy} onClick={attach} />
        </div>
      ) : null}
    </DetailSection>
  );
};

ReceiptProof.propTypes = {
  receiptId: PropTypes.string.isRequired,
  proof: PropTypes.shape({ key: PropTypes.string, fileName: PropTypes.string }),
  collectedBy: PropTypes.shape({ name: PropTypes.string, reference: PropTypes.string }),
  cancelled: PropTypes.bool,
};

ReceiptProof.defaultProps = { proof: null, collectedBy: null, cancelled: false };

export default ReceiptProof;
