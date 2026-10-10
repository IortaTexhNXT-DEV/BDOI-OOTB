import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useParams, useNavigate } from "react-router-dom";
import collectionService from "../../../services/collectionService";
import emailService from "../../../services/emailService";
import EmailDocumentDialog from "../../../components/EmailDocumentDialog";
import FollowUpModal from "../FollowUpModal";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";
import logger from "../../../utility/logger";
import { ActivityLog, fromCollectionActions } from "../../../components/ActivityLog";

const CollectionDetail = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useRef(null);

  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingFollowUp, setLoadingFollowUp] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpType, setFollowUpType] = useState("");
  const [showInvoiceEmail, setShowInvoiceEmail] = useState(false);

  const loadCollectionDetails = useCallback(async () => {
    setLoading(true);
    try {
      const result = await collectionService.getCollectionById(id);
      if (result.success) {
        setCollection(result.data);
      }
    } catch (error) {
      logger.error("Load collection details error:", error);
      toast.current?.show({
        severity: "error",
        summary: t("accounting.error"),
        detail: t("collectionDetail.failedToLoadCollection"),
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCollectionDetails();
  }, [loadCollectionDetails]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return formatAppDate(dateString);
  };

  const handleFollowUpAction = (type) => {
    setFollowUpType(type);
    setShowFollowUpModal(true);
  };
  const handleSendEmail = async (body) => {
    setLoadingFollowUp(true);
    // the server records the signed-in user as the one who sent it
    const sendEmail = await collectionService.sendEmail(collection.id, { notes: body });
    if (sendEmail.success) {
      toast.current?.show({
        severity: "success",
        summary: t("accounting.success"),
        detail: t("collectionDetail.emailSentSuccess"),
        life: 3000,
      });
      setTimeout(() => {
        setShowFollowUpModal(false);
        loadCollectionDetails();
        setLoadingFollowUp(false);
      }, 3000);
    } else {
      toast.current?.show({
        severity: "error",
        summary: t("accounting.error"),
        detail: t("collectionDetail.failedToSendEmail"),
        life: 3000,
      });
      setLoadingFollowUp(false);
      setTimeout(() => {
        setShowFollowUpModal(false);
        loadCollectionDetails();
        setLoadingFollowUp(false);
      }, 3000);
    }
  };

  const handleFollowUpSaved = () => {
    setShowFollowUpModal(false);
    loadCollectionDetails();
    toast.current?.show({
      severity: "success",
      summary: t("accounting.success"),
      detail: t("collectionDetail.followUpSavedSuccess"),
      life: 3000,
    });
  };

  if (loading || !collection) {
    return (
      <div className="collection-detail-container">
        <Card>
          <div className="p-4 text-center">Loading collection details...</div>
        </Card>
      </div>
    );
  }

  const client = collection.client || {};
  const parseShare = (value) => {
    const parsed = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const parseAmount = (value) => {
    const parsed = parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const round2 = (value) => Number((value || 0).toFixed(2));

  const isCoInsurance = Boolean(
    collection.isCoInsurancePolicy ||
      collection.policy?.isCoInsurance ||
      collection.policy?.quotation?.isCoInsurance
  );

  let coInsuranceRows = (collection.coInsuranceCollectionRows || []).slice();

  if (isCoInsurance && coInsuranceRows.length === 0) {
    const participants =
      collection.policy?.quotation?.participantDetails || [];
    const grossBase = parseAmount(collection.grossPremium);
    const paidBase = parseAmount(collection.paidAmount);
    const outstandingBase = parseAmount(collection.outstandingAmount);
    const rowStatus =
      collection.collectionStatus ||
      collection.policy?.status ||
      "Active";

    const participantRows = participants.map((participant, index) => {
      const sharePercentage = parseShare(participant.sharePercentage);
      return {
        participantId: participant.id || `participant-${index}`,
        insurer:
          participant.insuranceCompanyName ||
          participant.participantName ||
          "N/A",
        role: index === 0 ? "Lead Insurer" : "Co-Insurer",
        sharePercentage,
        grossPremium: round2((grossBase * sharePercentage) / 100),
        paidAmount: round2((paidBase * sharePercentage) / 100),
        outstandingAmount: round2((outstandingBase * sharePercentage) / 100),
        status: rowStatus,
        isTotal: false,
      };
    });

    if (participantRows.length > 0) {
      coInsuranceRows = [
        ...participantRows,
        {
          participantId: "total",
          insurer: "TOTAL",
          role: "",
          sharePercentage: round2(
            participantRows.reduce((sum, row) => sum + row.sharePercentage, 0)
          ),
          grossPremium: round2(
            participantRows.reduce((sum, row) => sum + row.grossPremium, 0)
          ),
          paidAmount: round2(
            participantRows.reduce((sum, row) => sum + row.paidAmount, 0)
          ),
          outstandingAmount: round2(
            participantRows.reduce(
              (sum, row) => sum + row.outstandingAmount,
              0
            )
          ),
          status: rowStatus,
          isTotal: true,
        },
      ];
    }
  }

  const localizeRole = (role, isTotal) => {
    if (isTotal || !role) return "";
    if (role === "Lead Insurer") return t("collectionDetail.leadInsurer");
    if (role === "Co-Insurer") return t("collectionDetail.coInsurer");
    return role;
  };

  const localizeInsurer = (insurer, isTotal) =>
    isTotal || insurer === "TOTAL" ? t("collectionDetail.total") : insurer;

  const getRoleClass = (role, isTotal) => {
    if (isTotal || !role) return "";
    if (
      role === "Lead Insurer" ||
      role === t("collectionDetail.leadInsurer")
    ) {
      return "role-pill role-pill--lead";
    }
    return "role-pill role-pill--co";
  };

  const getStatusClass = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (
      normalized === "active" ||
      normalized === "open" ||
      normalized === "settled"
    ) {
      return "status-text status-text--active";
    }
    return "status-text";
  };

  return (
    <div className="collection-detail-container">
      <Toast ref={toast} />

      <div className="detail-header">
        <Button
          icon="pi pi-arrow-left"
          label={t("collectionDetail.backToCollections")}
          className="p-button-text"
          onClick={() => navigate("/agent/collections")}
        />
        <h2>{t("collectionDetail.collectionDetails")}</h2>
      </div>

      {/* Client and Policy Information */}
      <Card title={t("collectionDetail.clientPolicyInfo")} className="info-card">
        <div className="info-grid">
          <div className="info-item">
            <label>{t("collectionDetail.clientName")}</label>
            <span>
              {`${client.firstName || ""} ${client.lastName || ""}`.trim()}
            </span>
          </div>
          <div className="info-item">
            <label>{t("collectionDetail.policyNumber")}</label>
            <span>{collection.policyNumber}</span>
          </div>
          <div className="info-item">
            <label>{t("collectionDetail.dueDate")}</label>
            <span>{formatDate(collection.dueDate)}</span>
          </div>
          <div className="info-item">
            <label>{t("collectionDetail.daysPastDue")}</label>
            <span className="highlight-danger">
              {collection.daysPastDue} {t("collectionDetail.days")}
            </span>
          </div>
          <div className="info-item">
            <label>{t("collectionDetail.status")}</label>
            <span
              className={`status-badge status-${collection.collectionStatus.toLowerCase()}`}
            >
              {collection.collectionStatus}
            </span>
          </div>
          <div className="info-item">
            <label>{t("collectionDetail.overdueLevel")}</label>
            <span className={`level-badge level-${collection.overdueLevel}`}>
              {t("collectionDetail.level")} {collection.overdueLevel}
            </span>
          </div>
        </div>
      </Card>

      {isCoInsurance && coInsuranceRows.length > 0 && (
        <Card className="info-card co-insurance-collection-section">
          <div className="co-insurance-collection-section__header">
            <div className="co-insurance-collection-section__title">
              {t("collectionDetail.coInsuranceDetails")}
            </div>
            <span className="co-insurance-policy-badge">
              {t("collectionDetail.coInsurancePolicyYes")}
            </span>
          </div>

          <table className="co-insurance-collection-table">
            <thead>
              <tr>
                <th>{t("collectionDetail.insurer")}</th>
                <th>{t("collectionDetail.role")}</th>
                <th className="numeric">
                  {t("collectionDetail.sharePercent")}
                </th>
                <th className="numeric">
                  {t("collectionDetail.grossPremiumCol")}
                </th>
                <th className="numeric paid">
                  {t("collectionDetail.paidAmountCol")}
                </th>
                <th className="numeric outstanding">
                  {t("collectionDetail.outstandingCol")}
                </th>
                <th>{t("collectionDetail.statusCol")}</th>
              </tr>
            </thead>
            <tbody>
              {coInsuranceRows.map((row) => (
                <tr
                  key={row.participantId}
                  className={row.isTotal ? "total-row" : ""}
                >
                  <td className="insurer-cell">
                    {localizeInsurer(row.insurer, row.isTotal)}
                  </td>
                  <td>
                    {localizeRole(row.role, row.isTotal) ? (
                      <span
                        className={getRoleClass(row.role, row.isTotal)}
                      >
                        {localizeRole(row.role, row.isTotal)}
                      </span>
                    ) : null}
                  </td>
                  <td className="numeric">
                    {`${Number(row.sharePercentage) || 0}%`}
                  </td>
                  <td className="numeric">
                    {formatCurrency(row.grossPremium)}
                  </td>
                  <td className="numeric paid">
                    {formatCurrency(row.paidAmount)}
                  </td>
                  <td className="numeric outstanding">
                    {formatCurrency(row.outstandingAmount)}
                  </td>
                  <td>
                    {row.status && !row.isTotal ? (
                      <span className={getStatusClass(row.status)}>
                        {row.status}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="co-insurance-collection-note">
            {t("collectionDetail.outstandingNote")}
          </div>
        </Card>
      )}

      {/* Financial Breakdown */}
      <Card title={t("collectionDetail.financialBreakdown")} className="financial-card">
        <div className="financial-grid">
          <div className="financial-item total">
            <label>{t("collectionDetail.grossPremium")}</label>
            <span>{formatCurrency(collection.grossPremium)}</span>
          </div>
          <div className="financial-item">
            <label>{t("collectionDetail.netPremium")}</label>
            <span>{formatCurrency(collection.netPremium)}</span>
          </div>
          <div className="financial-item">
            <label>{t("collectionDetail.vat")}</label>
            <span>{formatCurrency(collection.valueAddedTax)}</span>
          </div>
          <div className="financial-item">
            <label>{t("collectionDetail.dst")}</label>
            <span>{formatCurrency(collection.documentaryStampTax)}</span>
          </div>
          <div className="financial-item">
            <label>{t("collectionDetail.lgt")}</label>
            <span>{formatCurrency(collection.localGovernmentTax)}</span>
          </div>
          <div className="financial-item">
            <label>{t("collectionDetail.others")}</label>
            <span>{formatCurrency(collection.accountPremiumOthers)}</span>
          </div>
          <div className="financial-item">
            <label>{t("collectionDetail.discount")}</label>
            <span>{formatCurrency(collection.discount)}</span>
          </div>
          <div className="financial-item paid">
            <label>{t("collectionDetail.paidAmount")}</label>
            <span>{formatCurrency(collection.paidAmount)}</span>
          </div>
          <div className="financial-item outstanding">
            <label>{t("collectionDetail.outstanding")}</label>
            <span>{formatCurrency(collection.outstandingAmount)}</span>
          </div>
        </div>
      </Card>

      {/* Aging Breakdown */}
      <Card title={t("collectionDetail.agingAnalysis")} className="aging-card">
        <div className="aging-grid">
          <div className="aging-item">
            <label>{t("collectionDetail.currentNotDue")}</label>
            <span>{formatCurrency(collection.currentAmount)}</span>
          </div>
          <div className="aging-item">
            <label>{t("collectionDetail.days1to30")}</label>
            <span>{formatCurrency(collection.days1to30Amount)}</span>
          </div>
          <div className="aging-item">
            <label>{t("collectionDetail.days31to60")}</label>
            <span>{formatCurrency(collection.days31to60Amount)}</span>
          </div>
          <div className="aging-item">
            <label>{t("collectionDetail.days61to90")}</label>
            <span>{formatCurrency(collection.days61to90Amount)}</span>
          </div>
          <div className="aging-item danger">
            <label>{t("collectionDetail.over90Days")}</label>
            <span>{formatCurrency(collection.over90DaysAmount)}</span>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card title={t("collectionDetail.collectionActions")} className="actions-card">
        <div className="action-buttons-grid">
          <Button
            label={t("collectionDetail.sendEmail")}
            icon="pi pi-envelope"
            className="p-button-outlined p-button-primary"
            onClick={() => handleFollowUpAction("Email")}
          />
          <Button
            label={t("emailDocument.emailInvoice")}
            icon="pi pi-file-pdf"
            className="p-button-outlined p-button-primary"
            disabled={!collection.receivableId}
            onClick={() => setShowInvoiceEmail(true)}
          />
          <Button
            label={t("collectionDetail.addNote")}
            icon="pi pi-file-edit"
            className="p-button-outlined p-button-primary"
            onClick={() => handleFollowUpAction("Note")}
          />
          <Button
            label={t("collectionDetail.setCommitmentDate")}
            icon="pi pi-calendar"
            className="p-button-outlined p-button-secondary"
            onClick={() => handleFollowUpAction("Commitment")}
          />
        </div>
      </Card>

      {/* Follow-Up History */}
      <Card title={t("collectionDetail.followUpHistory")} className="history-card">
        <ActivityLog
          entries={fromCollectionActions(collection.followUpActions || [])}
          emptyText={t("collectionDetail.noFollowUpActions")}
        />
      </Card>

      {/* Payment History */}
      <Card title={t("collectionDetail.paymentHistory")} className="history-card">
        <DataTable
          value={collection.paymentHistory || []}
          emptyMessage={t("collectionDetail.noPaymentsRecorded")}
          className="payment-table"
          scrollable
          scrollHeight="400px"
        >
          <Column
            field="paymentDate"
            header={t("collectionDetail.date")}
            body={(rowData) => formatDate(rowData.paymentDate)}
            style={{ minWidth: "120px" }}
          />
          <Column
            field="paymentAmount"
            header={t("accounting.amount")}
            body={(rowData) => formatCurrency(rowData.paymentAmount)}
            style={{ minWidth: "120px" }}
          />
          <Column
            field="paymentMethod"
            header={t("collectionDetail.method")}
            style={{ minWidth: "100px" }}
          />
          <Column
            field="referenceNumber"
            header={t("collectionDetail.reference")}
            style={{ minWidth: "150px" }}
          />
          <Column
            field="remarks"
            header={t("collectionDetail.remarks")}
            style={{ minWidth: "200px" }}
          />
        </DataTable>
      </Card>

      {/* E-mail the invoice / statement of account of the bill with its PDF */}
      {collection.receivableId && (
        <EmailDocumentDialog
          visible={showInvoiceEmail}
          onHide={() => setShowInvoiceEmail(false)}
          title={t("emailDocument.emailInvoiceTitle", { number: collection.billNumber || "" })}
          defaultTo={collection.client?.email || ""}
          fileName={`invoice-${collection.billNumber}.pdf`}
          send={(body) => emailService.emailInvoice(collection.receivableId, body)}
          onSent={loadCollectionDetails}
        />
      )}

      {/* Follow-Up Modal */}
      <FollowUpModal
        loadingFollowUp={loadingFollowUp}
        collection={collection}
        visible={showFollowUpModal}
        onHide={() => setShowFollowUpModal(false)}
        collectionId={id}
        actionType={followUpType}
        handleSendEmail={handleSendEmail}
        onSaved={handleFollowUpSaved}
      />
    </div>
  );
};

export default CollectionDetail;
