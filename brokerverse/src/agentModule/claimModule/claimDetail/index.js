import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Skeleton } from "primereact/skeleton";
import { Message } from "primereact/message";
import { ConfirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";
import { getClaimDetails } from "../../claimsModule/adjusterSubmission/store/adjusterSubmissionMiddleWare";
import "./index.scss";

const ClaimDetail = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const { claimId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = React.useRef(null);

  const { claimDetails, loading, error } = useSelector(
    ({ adjusterSubmissionReducers }) => ({
      claimDetails: adjusterSubmissionReducers?.claimDetails || {},
      loading: adjusterSubmissionReducers?.claimDetailsLoading || false,
      error: adjusterSubmissionReducers?.claimDetailsError || null,
    })
  );

  useEffect(() => {
    if (claimId) {
      dispatch(getClaimDetails(claimId));
    }
  }, [dispatch, claimId]);

  const handleBack = () => {
    navigate("/agent/claim");
  };

  const formatDate = (dateString) => {
    if (!dateString) return t("policyDetail.nA");
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return t("policyDetail.nA");
    try {
      return new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  if (loading) {
    return (
      <div className="claim-detail-container">
        <div className="header">
          <h2>{t("claims.claimDetails")}</h2>
          <div className="actions">
            <Button
              label={t("claims.back")}
              icon="pi pi-arrow-left"
              className="p-button-outlined"
              onClick={handleBack}
            />
          </div>
        </div>
        <div className="grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-12 md:col-6">
              <Card>
                <Skeleton height="2rem" className="mb-2" />
                <Skeleton height="1rem" className="mb-2" />
                <Skeleton height="1rem" className="mb-2" />
                <Skeleton height="1rem" />
              </Card>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="claim-detail-container">
        <div className="header">
          <h2>{t("claims.claimDetails")}</h2>
          <div className="actions">
            <Button
              label={t("claims.back")}
              icon="pi pi-arrow-left"
              className="p-button-outlined"
              onClick={handleBack}
            />
          </div>
        </div>
        <Message
          severity="error"
          text={`${t("claims.errorLoading")}: ${error}`}
        />
      </div>
    );
  }

  const claimData = claimDetails?.data || {};
  const policyData = claimData?.policy || {};
  const thirdPartyData = claimData?.thirdPartyWitnessDetails?.[0] || {};

  const parseShare = (value) => {
    const parsed = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const round2 = (value) => Number((value || 0).toFixed(2));

  const isCoInsurance = Boolean(
    claimData.isCoInsurancePolicy ||
      claimData.isCoInsurance ||
      claimData.quotation?.isCoInsurance ||
      policyData.isCoInsurance
  );

  let coInsuranceRows = (claimData.coInsuranceSettlementRows || []).slice();

  if (isCoInsurance && coInsuranceRows.length === 0) {
    const participants = claimData.quotation?.participantDetails || [];
    const claimBase =
      Number(
        claimData.estimatedClaimAmount ??
          claimData.claimSettlementAmountFinal ??
          claimData.settlementAmount
      ) || 0;
    const settlementBase =
      Number(
        claimData.settlementAmount ??
          claimData.claimSettlementAmountFinal ??
          claimData.estimatedClaimAmount
      ) || 0;

    const participantRows = participants.map((participant, index) => {
      const sharePercentage = parseShare(participant.sharePercentage);
      return {
        participantId: participant.id || `participant-${index}`,
        insurer:
          participant.insuranceCompanyName ||
          participant.participantName ||
          t("policyDetail.nA"),
        role: index === 0 ? "Lead Insurer" : "Co-Insurer",
        sharePercentage,
        claimAmount: round2((claimBase * sharePercentage) / 100),
        settlementAmount: round2((settlementBase * sharePercentage) / 100),
        status: claimData.claimStatus || "",
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
          claimAmount: round2(
            participantRows.reduce((sum, row) => sum + row.claimAmount, 0)
          ),
          settlementAmount: round2(
            participantRows.reduce((sum, row) => sum + row.settlementAmount, 0)
          ),
          status: claimData.claimStatus || "",
          isTotal: true,
        },
      ];
    }
  }

  const localizeRole = (role, isTotal) => {
    if (isTotal || !role) return "";
    if (role === "Lead Insurer") return t("settlementDetails.leadInsurer");
    if (role === "Co-Insurer") return t("settlementDetails.coInsurer");
    return role;
  };

  const localizeInsurer = (insurer, isTotal) =>
    isTotal || insurer === "TOTAL" ? t("settlementDetails.total") : insurer;

  const localizeStatus = (status) =>
    status === "Settled" ? t("settlementDetails.settled") : status;

  const getRoleClass = (role, isTotal) => {
    if (isTotal || !role) return "";
    if (role === "Lead Insurer" || role === t("settlementDetails.leadInsurer")) {
      return "role-pill role-pill--lead";
    }
    return "role-pill role-pill--co";
  };

  const getStatusClass = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "settled") return "status-pill status-pill--settled";
    return "status-pill";
  };

  return (
    <div className="claim-detail-container">
      <div className="header">
        <h2>{t("claims.claimDetails")}</h2>
        <div className="actions">
          <Button
            label={t("claims.back")}
            icon="pi pi-arrow-left"
            className="p-button-outlined"
            onClick={handleBack}
          />
        </div>
      </div>

      <div className="grid">
        <div className="col-12 md:col-6">
          <Card className="detail-card">
            <h3>{t("claims.claimInformation")}</h3>
            <div className="detail-row">
              <span className="label">{t("claims.claimNumber")}</span>
              <span className="value">{claimData.claimNumber || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.insuranceCompanyClaimNumber")}</span>
              <span className="value">
                {claimData.insuranceCompanyClaimNumber || t("policyDetail.nA")}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.lineOfBusiness")}</span>
              <span className="value">{claimData.lob || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.claimType")}</span>
              <span className="value">{claimData.claimType || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.claimPriority")}</span>
              <span className="value">{claimData.claimPriority || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.claimStatus")}</span>
              <span className="value">{claimData.claimStatus || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.estimatedClaimAmount")}</span>
              <span className="value">
                {claimData.estimatedClaimAmount
                  ? formatCurrency(claimData.estimatedClaimAmount)
                  : t("policyDetail.nA")}
              </span>
            </div>
          </Card>
        </div>

        <div className="col-12 md:col-6">
          <Card className="detail-card">
            <h3>{t("claims.incidentInformation")}</h3>
            <div className="detail-row">
              <span className="label">{t("claims.dateOfIncident")}</span>
              <span className="value">
                {formatDate(claimData.dateOfIncident)}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.timeOfIncident")}</span>
              <span className="value">{claimData.timeOfIncident || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.addressOfIncident")}</span>
              <span className="value">
                {claimData.addressOfIncident || t("policyDetail.nA")}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.cityOfIncident")}</span>
              <span className="value">{claimData.cityOfIncident || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.provinceOfIncident")}</span>
              <span className="value">
                {claimData.provinceOfIncident || t("policyDetail.nA")}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.typeOfIncident")}</span>
              <span className="value">{claimData.typeOfIncident || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.reportedDate")}</span>
              <span className="value">
                {formatDate(claimData.reportedDate)}
              </span>
            </div>
          </Card>
        </div>

        <div className="col-12 md:col-6">
          <Card className="detail-card">
            <h3>{t("claims.driverInformation")}</h3>
            <div className="detail-row">
              <span className="label">{t("claims.driverName")}</span>
              <span className="value">{claimData.driverName || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.isPolicyHolderTheDriver")}</span>
              <span className="value">
                {claimData.isPolicyHolderTheDriver ? t("claims.yes") : t("claims.no")}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.driverHouseNo")}</span>
              <span className="value">{claimData.driverHouseNo || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.driverBarangay")}</span>
              <span className="value">{claimData.driverBarangay || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.driverCountry")}</span>
              <span className="value">{claimData.driverCountry || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.driverProvince")}</span>
              <span className="value">{claimData.driverProvince || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.driverCity")}</span>
              <span className="value">{claimData.driverCity || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.driverZipCode")}</span>
              <span className="value">{claimData.driverZipCode || t("policyDetail.nA")}</span>
            </div>
            {(claimData.driverRoadThanon ||
              claimData.driverSoiAlley ||
              claimData.driverMooVillage) && (
              <>
                <div className="detail-row">
                  <span className="label">{t("claims.driverRoadThanon")}</span>
                  <span className="value">
                    {claimData.driverRoadThanon || t("policyDetail.nA")}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">{t("claims.driverSoiAlley")}</span>
                  <span className="value">
                    {claimData.driverSoiAlley || t("policyDetail.nA")}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">{t("claims.driverMooVillage")}</span>
                  <span className="value">
                    {claimData.driverMooVillage || t("policyDetail.nA")}
                  </span>
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="col-12 md:col-6">
          <Card className="detail-card">
            <h3>{t("claims.policyInformation")}</h3>
            <div className="detail-row">
              <span className="label">{t("claims.policyNumberLabel")}</span>
              <span className="value">{policyData.policyNumber || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.insuredName")}</span>
              <span className="value">{policyData.insuredName || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.leadRefId")}</span>
              <span className="value">{claimData.leadRefId || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.quoteRefId")}</span>
              <span className="value">{claimData.quoteRefId || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.policyRefId")}</span>
              <span className="value">{claimData.policyRefId || t("policyDetail.nA")}</span>
            </div>
            {(claimData.country ||
              claimData.houseNo ||
              claimData.roadThanon ||
              claimData.soiAlley ||
              claimData.mooVillage) && (
              <>
                <div className="detail-row">
                  <span className="label">{t("claims.country")}</span>
                  <span className="value">
                    {claimData.country || t("policyDetail.nA")}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">{t("claims.province")}</span>
                  <span className="value">
                    {claimData.province || t("policyDetail.nA")}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">{t("claims.city")}</span>
                  <span className="value">
                    {claimData.city || t("policyDetail.nA")}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">{t("claims.houseNo")}</span>
                  <span className="value">
                    {claimData.houseNo || t("policyDetail.nA")}
                  </span>
                </div>
                {(claimData.roadThanon ||
                  claimData.soiAlley ||
                  claimData.mooVillage) && (
                  <>
                    <div className="detail-row">
                      <span className="label">{t("claims.roadThanon")}</span>
                      <span className="value">
                        {claimData.roadThanon || t("policyDetail.nA")}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">{t("claims.soiAlley")}</span>
                      <span className="value">
                        {claimData.soiAlley || t("policyDetail.nA")}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">{t("claims.mooVillage")}</span>
                      <span className="value">
                        {claimData.mooVillage || t("policyDetail.nA")}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
          </Card>
        </div>

        {thirdPartyData && Object.keys(thirdPartyData).length > 0 && (
          <div className="col-12 md:col-6">
            <Card className="detail-card">
              <h3>{t("claims.thirdPartyInformation")}</h3>
              <div className="detail-row">
                <span className="label">{t("claims.thirdPartyName")}</span>
                <span className="value">
                  {thirdPartyData.thirdPartyName || t("policyDetail.nA")}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("claims.contactNumber")}</span>
                <span className="value">
                  {thirdPartyData.thirdPartyContactNumber || t("policyDetail.nA")}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("claims.plateNumber")}</span>
                <span className="value">
                  {thirdPartyData.thirdPartyPlateNumber || t("policyDetail.nA")}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("claims.unit")}</span>
                <span className="value">
                  {thirdPartyData.thirdPartyUnit || t("policyDetail.nA")}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("claims.shop")}</span>
                <span className="value">
                  {thirdPartyData.thirdPartyShop || t("policyDetail.nA")}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("claims.policyNumberLabel")}</span>
                <span className="value">
                  {thirdPartyData.thirdPartyPolicyNumber || t("policyDetail.nA")}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("claims.insuranceCompany")}</span>
                <span className="value">
                  {thirdPartyData.thirdPartyInsuranceCompanyName || t("policyDetail.nA")}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("claims.witnessName")}</span>
                <span className="value">
                  {thirdPartyData.witnessName || t("policyDetail.nA")}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">{t("claims.witnessContact")}</span>
                <span className="value">
                  {thirdPartyData.witnessContact || t("policyDetail.nA")}
                </span>
              </div>
            </Card>
          </div>
        )}

        <div className="col-12 md:col-6">
          <Card className="detail-card">
            <h3>{t("claims.systemInformation")}</h3>
            <div className="detail-row">
              <span className="label">{t("claims.createdDate")}</span>
              <span className="value">
                {formatDateTime(claimData.createdAt)}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.lastUpdated")}</span>
              <span className="value">
                {formatDateTime(claimData.updatedAt)}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.createdBy")}</span>
              <span className="value">{claimData.createdBy || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.updatedBy")}</span>
              <span className="value">{claimData.updatedBy || t("policyDetail.nA")}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.claimDueDate")}</span>
              <span className="value">
                {formatDate(claimData.claimDueDate)}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">{t("claims.claimRunDate")}</span>
              <span className="value">
                {formatDate(claimData.claimRunDate)}
              </span>
            </div>
          </Card>
        </div>

        {isCoInsurance && coInsuranceRows.length > 0 && (
          <div className="col-12">
            <Card className="detail-card co-insurance-settlement-section">
              <div className="co-insurance-settlement-section__header">
                <h3 className="co-insurance-settlement-section__title">
                  {t("settlementDetails.coInsuranceDetails")}
                </h3>
                <span className="co-insurance-policy-badge">
                  {t("settlementDetails.coInsurancePolicyYes")}
                </span>
              </div>

              <table className="co-insurance-settlement-table">
                <thead>
                  <tr>
                    <th>{t("settlementDetails.insurer")}</th>
                    <th>{t("settlementDetails.role")}</th>
                    <th className="numeric">
                      {t("settlementDetails.sharePercent")}
                    </th>
                    <th className="numeric">
                      {t("settlementDetails.claimAmount")}
                    </th>
                    <th className="numeric settlement">
                      {t("settlementDetails.settlementAmountCol")}
                    </th>
                    <th>{t("settlementDetails.status")}</th>
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
                        {formatCurrency(row.claimAmount)}
                      </td>
                      <td className="numeric settlement">
                        {formatCurrency(row.settlementAmount)}
                      </td>
                      <td>
                        {row.status ? (
                          <span className={getStatusClass(row.status)}>
                            {localizeStatus(row.status)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="co-insurance-settlement-note">
                {t("settlementDetails.settlementAmountNote")}
              </div>
            </Card>
          </div>
        )}
      </div>

      <Toast ref={toast} />
      <ConfirmDialog />
    </div>
  );
};

export default ClaimDetail;
