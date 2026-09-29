import "./index.scss";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Button } from "primereact/button";
import DropdownField from "../../component/DropdwonField";
import InputTextField from "../../component/inputText";
import DatepickerField from "../../component/datePicker";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import document from "../../../assets/images/document.png";
const ClaimDocumentUpload = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { claimDocumentUploadData } = useSelector(
    ({ claimDocumentUploadMainReducers }) => {
      return {
        loading: claimDocumentUploadMainReducers?.loading,
        claimDocumentUploadData:
          claimDocumentUploadMainReducers?.claimDocumentUploadData,
      };
    }
  );
  const cityData = [
    {
      label: claimDocumentUploadData.city,
      value: claimDocumentUploadData.city,
    },
  ];
  const provinceData = [
    {
      label: claimDocumentUploadData.province,
      value: claimDocumentUploadData.province,
    },
  ];
  const cuntryData = [
    {
      label: claimDocumentUploadData.country,
      value: claimDocumentUploadData.country,
    },
  ];
  const Navigate = useNavigate();
  const clientId =
    location.state?.clientId || claimDocumentUploadData?.clientId;

  const handleCommonAction = () => {
    if (clientId) {
      Navigate(`/agent/clientview/${clientId}`);
    } else {
      Navigate(-1);
    }
  };
  return (
    <div className="claim__docupload__upload__container">
      <div className="claim__request__upload__main__title">{t("agent.clients")}</div>
      <div
        className="claim__request__upload__back__btn mt-3 cursor-pointer"
        onClick={handleCommonAction}
      >
        <SvgLeftArrow />
        <div className="claim__request__upload__back__btn__title">
          {t("agent.clientIdLabel")} {clientId || ""}
        </div>
      </div>
      <Card className="mt-4">
        <div className="claim__request__upload__title">{t("agent.claimRequest")}</div>

        <div class="grid">
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.adjusterName")}
              value={claimDocumentUploadData.adjusterName}
            />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.claimNumber")}
              value={claimDocumentUploadData.claimNumber}
            />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <DatepickerField
              label={t("agent.dateOfReported")}
              value={new Date(claimDocumentUploadData.dateOfReported)}
            />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <DatepickerField
              label={t("agent.dateOfLoss")}
              value={new Date(claimDocumentUploadData.dateOfLoss)}
            />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.placeOfAccident")}
              value={claimDocumentUploadData.placeOfAccident}
            />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.driversName")}
              value={claimDocumentUploadData.driversName}
            />
          </div>

          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.houseNoUnitStreet")}
              value={claimDocumentUploadData.houseNumber}
            />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.barangaySubd")}
              value={claimDocumentUploadData.barangay}
            />
          </div>

          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label={t("agent.country")}
              value={claimDocumentUploadData.country}
              options={cuntryData}
              optionLabel={"label"}
              optionValue="label"
            />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label={t("agent.province")}
              value={claimDocumentUploadData.province}
              options={provinceData}
              optionLabel={"label"}
              optionValue="label"
            />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label={t("agent.city")}
              value={claimDocumentUploadData.city}
              options={cityData}
              optionLabel={"label"}
              optionValue="label"
            />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.zipCode")}
              value={claimDocumentUploadData.zipCode}
            />
          </div>
          <div className="col-12 claim__request__upload__subtitle mt-2 mb-2">
            {t("agent.thirdPartyDetails")}
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField label={t("agent.name")} />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField label={t("agent.contactNumber")} />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField label={t("agent.plateNumber")} />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField label={t("agent.unit")} />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField label={t("agent.shop")} />
          </div>
          <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField label={t("agent.insuranceCompanyName") + "*"} />
          </div>
          <div className="col-12 claim__request__upload__subtitle mt-2 mb-2">
            {t("agent.proofOfDocuments")}
          </div>

          <div className="uploaddoc__conatiner">
            <img src={document} className="claimtitle__img__container" />
            <img src={document} className="claimtitle__img__container" />
          </div>

          <div className="col-12 mt-3">
            <div className="back__next__btn__container">
              <div className="back__btn__container">
                <Button className="back__btn" onClick={handleCommonAction}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClaimDocumentUpload;
