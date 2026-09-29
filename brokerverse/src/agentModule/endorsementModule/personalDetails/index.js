import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CustomToast from "../../../components/Toast";
import PersonalDetailsChange from "./SplitScreens/PersonalDetailsChange";
import MotorDetailsChange from "./SplitScreens/MotorDetailsChange";
import CoverageChange from "./SplitScreens/CoverageChange";
import PolicyExtend from "./SplitScreens/PolicyExtend";
import FireDetailsChange from "./SplitScreens/FireDetailsChange";
import FireCancellation from "./SplitScreens/FireCancellation";
import { normalizeCountryName } from "../../../utility/addressHelpers";
import { isFireLob } from "../constants/endorsementCategories";
import { useDispatch, useSelector } from "react-redux";
import { getpolicyDetailedMiddleware } from "../../quoteModule/policyDetailedView/store/policyDetailedMiddleware";
import endorsementService from "../../../services/endorsementService";
import { fetchProductTemplateByIdMiddleware } from "../../../module/ProductConfigurator/store/productConfiguratorMiddleware";
import { notifyError } from "../../../utility/dialogs";

const PersonalDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [submitTargetIndex, setSubmitTargetIndex] = useState(null);
  // values each section submitted (what the user edited), by section index
  const sectionValuesRef = useRef({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(null);

  const { policydetailedlist, productConfigurator } = useSelector(
    ({ policyDetailedViewMainReducers, productConfiguratorReducer }) => ({
      policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
      productConfigurator: productConfiguratorReducer?.template,
    })
  );

  const lob = state?.lob || state?.productType || null;
  const isFire = isFireLob(lob);

  const toastRef = useRef(null);

  useEffect(() => {
    if (!isFire) {
      dispatch(
        fetchProductTemplateByIdMiddleware({ templateCode: "MOT-003-2025" })
      );
    }
    if (id) {
      dispatch(getpolicyDetailedMiddleware({ policyId: id }));
    }
  }, [id, dispatch, isFire]);

  const endorsementTypes = useMemo(() => {
    const typesValue = state?.types;

    if (Array.isArray(typesValue)) {
      return typesValue.map((type) => type.toString());
    }

    if (typeof typesValue === "string") {
      return [typesValue];
    }

    return [];
  }, [state]);

  const endorsementTypeSet = useMemo(
    () => new Set(endorsementTypes),
    [endorsementTypes]
  );

  const availableSections = useMemo(() => {
    if (isFire) {
      return endorsementTypes.filter(
        (t) => t === "fire_regular" || t === "fire_cancel"
      );
    }
    const sectionOrder = ["1", "2", "3", "4"];
    return sectionOrder.filter((key) => endorsementTypeSet.has(key));
  }, [endorsementTypeSet, endorsementTypes, isFire]);

  // Extract clientId and clientName BEFORE using them in callbacks
  const clientName =
    state?.ClientName ||
    state?.clientName ||
    policydetailedlist?.ClientName ||
    policydetailedlist?.clientName;
  const clientId =
    state?.ClientId ||
    state?.clientId ||
    policydetailedlist?.ClientId ||
    policydetailedlist?.clientId;

  // Prepare all data objects BEFORE callbacks
  const personalDetailsData = useMemo(() => {
    // The client record holds the current details (a completed personal details endorsement updates it); the lead
    // only has what was captured before the policy, so it is the fallback.
    const lead = policydetailedlist?.lead || {};
    const client = policydetailedlist?.client || {};
    const pick = (clientValue, leadValue) => clientValue || leadValue || "";

    return {
      CompanyName: pick(client.companyName, lead?.companyName),
      TaxNumber: pick(client.taxNumber, lead?.taxNumber),
      FirstName: pick(client.firstName, lead?.firstName),
      LastName: pick(client.lastName, lead?.lastName),
      PreferredName:
        policydetailedlist?.insuredName || policydetailedlist?.ClientName || client.displayName || "",
      EmailID: pick(client.emailId || client.email, lead?.emailId),
      ContactNumber: pick(client.contactNumber || client.phone, lead?.contactNumber),
      HouseNo: pick(client.houseNo, lead?.houseNo),
      Barangay: pick(client.barangay, lead?.barangay),
      Country: normalizeCountryName(pick(client.country, lead?.country)),
      Province: pick(client.province, lead?.province),
      City: pick(client.city, lead?.city),
      ZIPCode: pick(client.zipCode, lead?.zipCode),
      DateofBirth: pick(client.DOB, lead?.dateOfBirth),
    };
  }, [policydetailedlist]);

  const motorDetailsData = useMemo(() => {
    const quotation = policydetailedlist?.quotation || {};
    const vehicleDetails = quotation?.insuranceVehicleDetails?.[0] || {};

    return {
      TNVS: policydetailedlist?.TNVS || "",
      MotorNumber: policydetailedlist?.motorNumber || "",
      ChassisNumber: policydetailedlist?.chassisNumber || "",
      Mortgage: policydetailedlist?.mortgage || "",
      CertNumber: policydetailedlist?.certNumber || "",
      PlateNumber: policydetailedlist?.plateNumber || "",
      MVFileNumber:
        policydetailedlist?.MvFileNumber ||
        policydetailedlist?.mvFileNumber ||
        "",
      AuthenCode: policydetailedlist?.authenCode || "",
      VehicleBrand:
        policydetailedlist?.vehicleBrand || vehicleDetails?.vehicleBrand || "",
      ModelYear:
        policydetailedlist?.modelYear || vehicleDetails?.modelYear || "",
      ModelVariant:
        policydetailedlist?.modelVariant || vehicleDetails?.modelVariant || "",
      VehicleModel:
        policydetailedlist?.vehicleModel || vehicleDetails?.vehicleModel || "",
      VehicleColor:
        policydetailedlist?.vehicleColor || vehicleDetails?.vehicleColor || "",
      SeatingCapacity:
        policydetailedlist?.seatingCapacity ||
        vehicleDetails?.seatingCapacity ||
        "",
      // Additional fields from policy
      RepairLimit: policydetailedlist?.repairLimit || "",
      Towing: policydetailedlist?.towing || "",
      Deductible: policydetailedlist?.deductible || "",
      Stereo: policydetailedlist?.stereo || "",
      MagWheels: policydetailedlist?.magWheels || "",
      Aircon: policydetailedlist?.aircon || "",
      Aluminum: policydetailedlist?.aluminum || "",
      AirBag: policydetailedlist?.airBag || "",
      TruckType: policydetailedlist?.truckType || "",
    };
  }, [policydetailedlist]);

  const [coverageDetails, setCoverageDetails] = useState({});
  // the policy's current gross premium (premium total), the base of the endorsement premium change
  const currentGrossPremium =
    policydetailedlist?.grossPremium ??
    policydetailedlist?.premiumTotal ??
    policydetailedlist?.quotation?.grossPremium ??
    "";
  const [fireEndorsementPayload, setFireEndorsementPayload] = useState(null);

  useEffect(() => {
    const quotation = policydetailedlist?.quotation || {};

    const coverageDetailss = {
      policyId: policydetailedlist?.policyId || "",
      policyNumber: policydetailedlist?.policyNumber || "",
      LossandDamagecoverage:
        policydetailedlist?.lossAndDamageCoverage ||
        quotation?.lossAndDamageCoverage ||
        "",
      LossandDamagecoverageRate:
        policydetailedlist?.lossAndDamageCoverageRate ||
        quotation?.lossAndDamageCoverageRate ||
        "",
      LossandDamagecoveragepremium:
        policydetailedlist?.lossAndDamageCoveragePremium ||
        quotation?.lossAndDamageCoveragePremium ||
        "",
      ActsofNatureRate:
        policydetailedlist?.actsOfNatureRate ||
        quotation?.actsOfNatureRate ||
        "",
      ActsofNaturepremium:
        policydetailedlist?.actsOfNaturePremium ||
        quotation?.actsOfNaturePremium ||
        "",
      BodilyInjury:
        policydetailedlist?.bodilyInjury || quotation?.bodilyInjury || "",
      BodilyInjuryCoveragePremium:
        policydetailedlist?.bodilyInjuryCoveragePremium ||
        quotation?.bodilyInjuryCoveragePremium ||
        "",
      PropertyDamage:
        policydetailedlist?.propertyDamage || quotation?.propertyDamage || "",
      PropertyDamageCoveragePremium:
        policydetailedlist?.propertyDamageCoveragePremium ||
        quotation?.propertyDamageCoveragePremium ||
        "",
      AutopassengerpersonalAccident:
        policydetailedlist?.autoPassengerPersonalAccident ||
        quotation?.autoPassengerPersonalAccident ||
        "",
      APPATotalCoverage:
        policydetailedlist?.APPAtotalCoverage ||
        quotation?.aPPAtotalCoverage ||
        "",
      APPAcoveragePremium:
        policydetailedlist?.APPAcoveragePremium ||
        quotation?.aPPAcoveragePremium ||
        "",
      TotalSumInsured:
        policydetailedlist?.totalCoverage || quotation?.totalSumInsured || "",
      NETpremium: policydetailedlist?.netPremium || quotation?.netPremium || "",
      ValueAddedTax:
        policydetailedlist?.valueAddedTax || quotation?.valueAddedTax || "",
      OthersPremium:
        policydetailedlist?.accountPremiumOthers ||
        quotation?.accountPremiumOthers ||
        "",
      DocumentaryStampTax:
        policydetailedlist?.documentaryStampTax ||
        quotation?.documentaryStampTax ||
        "",
      LocalGovtTax:
        policydetailedlist?.localGovernmentTax ||
        quotation?.localGovernmentTax ||
        "",
      Discount: policydetailedlist?.discount || quotation?.discount || "",
      Others: policydetailedlist?.others || quotation?.others || "",
      Grosspremium:
        policydetailedlist?.grossPremium || quotation?.grossPremium || "",
      NCD: policydetailedlist?.NCD || "",
      paymentStatus: policydetailedlist?.paymentStatus || "",
      paymentStatusChangedAt: policydetailedlist?.paymentStatusChangedAt || "",
      // the policy's own CTPL (flat) and cover rates: re-pricing must not add covers the policy does not have
      CtplCoverageRate:
        policydetailedlist?.ctplCoverageRate ??
        quotation?.ctplCoverageRate ??
        policydetailedlist?.ctplCoveragePremium ??
        quotation?.ctplCoveragePremium ??
        "",
      RoadsideAssistanceRate:
        policydetailedlist?.roadsideAssistanceRate ||
        quotation?.roadsideAssistanceRate ||
        "",
      RoadsideAssistancePremium:
        policydetailedlist?.roadsideAssistancePremium ||
        quotation?.roadsideAssistancePremium ||
        "",
      PersonalAccidentCoverRate:
        policydetailedlist?.personalAccidentCoverRate ||
        quotation?.personalAccidentCoverRate ||
        "",
      PersonalAccidentCoverPremium:
        policydetailedlist?.personalAccidentCoverPremium ||
        quotation?.personalAccidentCoverPremium ||
        "",
      BodilyInjuryRate:
        policydetailedlist?.bodilyInjuryRate || quotation?.bodilyInjuryRate || "",
      PropertyDamageRate:
        policydetailedlist?.propertyDamageRate ||
        quotation?.propertyDamageRate ||
        "",
      APPARate: policydetailedlist?.APPARate || quotation?.APPARate || "",
    };

    setCoverageDetails(coverageDetailss);
  }, [policydetailedlist]);

  const policyExtendDetails = useMemo(() => {
    const quotation = policydetailedlist?.quotation || {};

    return {
      FromDate:
        policydetailedlist?.inception ||
        policydetailedlist?.production ||
        policydetailedlist?.issuedDate ||
        policydetailedlist?.inceptionDate ||
        "",
      ToDate:
        policydetailedlist?.expiry ||
        policydetailedlist?.expirationDate ||
        policydetailedlist?.expiryDate ||
        "",
      NumberofDays: policydetailedlist?.numberOfDays || "",
      LossandDamagecoverage:
        policydetailedlist?.lossAndDamageCoverage ||
        quotation?.lossAndDamageCoverage ||
        "",
      LossandDamagecoverageRate:
        policydetailedlist?.lossAndDamageCoverageRate ||
        quotation?.lossAndDamageCoverageRate ||
        "",
      LossandDamagecoveragepremium:
        policydetailedlist?.lossAndDamageCoveragePremium ||
        quotation?.lossAndDamageCoveragePremium ||
        "",
      ActsOfNatureRate:
        policydetailedlist?.actsOfNatureRate ||
        quotation?.actsOfNatureRate ||
        "",
      ActsofNaturepremium:
        policydetailedlist?.actsOfNaturePremium ||
        quotation?.actsOfNaturePremium ||
        "",
      BodilyInjury:
        policydetailedlist?.bodilyInjury || quotation?.bodilyInjury || "",
      BodilyInjuryCoveragePremium:
        policydetailedlist?.bodilyInjuryCoveragePremium ||
        quotation?.bodilyInjuryCoveragePremium ||
        "",
      PropertyDamage:
        policydetailedlist?.propertyDamage || quotation?.propertyDamage || "",
      PropertyDamageCoveragePremium:
        policydetailedlist?.propertyDamageCoveragePremium ||
        quotation?.propertyDamageCoveragePremium ||
        "",
      AutopassengerpersonalAccident:
        policydetailedlist?.autoPassengerPersonalAccident ||
        quotation?.autoPassengerPersonalAccident ||
        "",
      APPATotalCoverage:
        policydetailedlist?.APPAtotalCoverage ||
        quotation?.aPPAtotalCoverage ||
        "",
      TotalSumInsured:
        policydetailedlist?.totalCoverage || quotation?.totalSumInsured || "",
      NETpremium: policydetailedlist?.netPremium || quotation?.netPremium || "",
      ValueAddedTax:
        policydetailedlist?.valueAddedTax || quotation?.valueAddedTax || "",
      OthersPremium:
        policydetailedlist?.accountPremiumOthers ||
        quotation?.accountPremiumOthers ||
        "",
      DocumentaryStampTax:
        policydetailedlist?.documentaryStampTax ||
        quotation?.documentaryStampTax ||
        "",
      LocalGovtTax:
        policydetailedlist?.localGovernmentTax ||
        quotation?.localGovernmentTax ||
        "",
      Discount: policydetailedlist?.discount || quotation?.discount || "",
      Others: policydetailedlist?.others || quotation?.others || "",
      Grosspremium:
        policydetailedlist?.grossPremium || quotation?.grossPremium || "",
      Title:
        policydetailedlist?.product ||
        quotation?.productName ||
        quotation?.insurancePolicyType ||
        "",
      Declaration: policydetailedlist?.others || quotation?.others || "",
    };
  }, [policydetailedlist]);

  const handleToastAndNavigate = useCallback(
    async (firePayloadOverride = null) => {
      // Fire LOB: use payload from FireDetailsChange or FireCancellation
      if (isFire) {
        const basePayload = { policyId: id };
        let payload;

        if (firePayloadOverride) {
          payload = { ...basePayload, ...firePayloadOverride };
        } else if (endorsementTypeSet.has("fire_cancel")) {
          payload = {
            ...basePayload,
            isCancelPolicy: true,
            cancellationType: "FULL",
          };
          const grossPremium = parseFloat(
            policydetailedlist?.grossPremium ||
              policydetailedlist?.quotation?.firePremiumDetails?.totalPremium ||
              policydetailedlist?.quotation?.totalPremium ||
              0
          );
          if (grossPremium > 0) {
            payload.premiumDelta = -Math.abs(grossPremium);
          }
        } else {
          return;
        }

        try {
          const response = await endorsementService.createEndorsement(payload);
          if (response.success) {
            const endorsementId = response.data?.endorsementId;
            if (!endorsementId) {
              notifyError(
                "Endorsement created but ID not returned. Response: " +
                  JSON.stringify(response.data)
              );
              return;
            }
            toastRef.current?.showToast();
            setTimeout(() => {
              navigate(`/agent/endorsement/summary/${endorsementId}`, {
                state: {
                  endorsementId,
                  policyId: id,
                  clientId: clientId || policydetailedlist?.clientId,
                  clientNumber:
                    policydetailedlist?.ClientId ||
                    policydetailedlist?.client?.clientId,
                  clientName,
                  endorsementData: response.data,
                },
              });
            }, 2000);
          } else {
            console.error("API returned success: false", response.error);
            notifyError(response.error || "Failed to create endorsement");
          }
        } catch (error) {
          console.error("Error creating endorsement:", error);
          notifyError("Error creating endorsement: " + error.message);
        }
        return;
      }

      // Motor LOB: existing flow
      const payload = {
        policyId: id,
        endorsementTypeIds: endorsementTypes.map(Number),
      };

      const edited = sectionValuesRef.current;
      if (endorsementTypeSet.has("1")) {
        payload.personalDetails = edited[1] || personalDetailsData;
      }
      if (endorsementTypeSet.has("2")) {
        payload.motorDetails = edited[2] || motorDetailsData;
      }
      if (endorsementTypeSet.has("3")) {
        // the edited (re-priced) coverage; the premium change is new gross - the policy's current gross
        // (positive = additional premium, negative = return premium); the server re-prices and checks it
        const coverage = edited[3] || coverageDetails;
        payload.coverageChanges = coverage;
        const newGross = parseFloat(String(coverage?.Grosspremium ?? "").replace(/,/g, ""));
        const currentGross = parseFloat(
          String(currentGrossPremium ?? "").replace(/,/g, "")
        );
        if (Number.isFinite(newGross) && Number.isFinite(currentGross)) {
          payload.premiumDelta =
            Math.round((newGross - currentGross + Number.EPSILON) * 100) / 100;
        }
      }
      if (endorsementTypeSet.has("4")) {
        payload.policyExtension = policyExtendDetails;
      }
      if (endorsementTypeSet.has("5")) {
        payload.personalDetails = personalDetailsData;
        payload.motorDetails = motorDetailsData;
        payload.coverageChanges = coverageDetails;
        payload.policyExtension = policyExtendDetails;
        payload.isCancelPolicy = true;
        payload.cancellationType = "PARTIAL";

        const grossPremium = parseFloat(
          policydetailedlist?.grossPremium ||
            policydetailedlist?.quotation?.grossPremium ||
            coverageDetails?.Grosspremium ||
            0
        );
        if (grossPremium > 0) {
          payload.premiumDelta = -Math.abs(grossPremium);
        }
      }

      try {
        const response = await endorsementService.createEndorsement(payload);

        if (response.success) {
          const endorsementId = response.data?.endorsementId;

          if (!endorsementId) {
            notifyError(
              "Endorsement created but ID not returned. Response: " +
                JSON.stringify(response.data)
            );
            return;
          }

          toastRef.current?.showToast();

          setTimeout(() => {
            navigate(`/agent/endorsement/summary/${endorsementId}`, {
              state: {
                endorsementId,
                policyId: id,
                clientId: clientId || policydetailedlist?.clientId,
                clientNumber:
                  policydetailedlist?.ClientId ||
                  policydetailedlist?.client?.clientId,
                clientName,
                endorsementData: response.data,
              },
            });
          }, 2000);
        } else {
          console.error("API returned success: false", response.error);
          notifyError(response.error || "Failed to create endorsement");
        }
      } catch (error) {
        console.error("Error creating endorsement:", error);
        notifyError("Error creating endorsement: " + error.message);
      }
    },
    [
    navigate,
    id,
    clientId,
    clientName,
    endorsementTypes,
    endorsementTypeSet,
    personalDetailsData,
    motorDetailsData,
    coverageDetails,
    currentGrossPremium,
    policyExtendDetails,
    policydetailedlist,
    isFire,
  ]);

  const handleButtonClick = useCallback(() => {
    if (!availableSections.length) {
      handleToastAndNavigate();
      return;
    }

    const firstSection = availableSections[0];
    setCurrentSectionIndex(isFire ? firstSection : Number(firstSection));
    setSubmitTargetIndex(isFire ? firstSection : Number(firstSection));
  },     [
    availableSections,
    handleToastAndNavigate,
    endorsementTypes,
    endorsementTypeSet,
    isFire,
  ]);

  const handleSectionInvalid = useCallback(() => {
    setCurrentSectionIndex(null);
    setSubmitTargetIndex(null);
  }, []);

  const handleSectionSubmitted = useCallback(
    (index, payload) => {
      if (currentSectionIndex !== index) {
        return;
      }
      if (payload && typeof payload === "object") sectionValuesRef.current[index] = payload;

      if (isFire && payload) {
        if (payload.isCancelPolicy) {
          const grossPremium = parseFloat(
            policydetailedlist?.grossPremium ||
              policydetailedlist?.quotation?.firePremiumDetails?.totalPremium ||
              policydetailedlist?.quotation?.totalPremium ||
              0
          );
          if (grossPremium > 0) {
            payload.premiumDelta = -Math.abs(grossPremium);
          }
        }
        setCurrentSectionIndex(null);
        setSubmitTargetIndex(null);
        handleToastAndNavigate(payload);
        return;
      }

      const currentKey = String(index);
      const currentPosition = availableSections.indexOf(currentKey);
      const nextKey =
        currentPosition >= 0 ? availableSections[currentPosition + 1] : null;

      if (index === 4 && payload) {
        console.debug("Policy extend submission", payload);
      }

      if (!nextKey) {
        setCurrentSectionIndex(null);
        setSubmitTargetIndex(null);
        handleToastAndNavigate();
        return;
      }

      setCurrentSectionIndex(Number(nextKey));
      setSubmitTargetIndex(Number(nextKey));
    },
    [
      availableSections,
      currentSectionIndex,
      handleToastAndNavigate,
      isFire,
      policydetailedlist,
    ]
  );

  const handleClientViewNavigation = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const displayTitle = useMemo(() => {
    const parts = [];

    if (clientName) {
      parts.push(clientName);
    }
    if (policydetailedlist?.ClientId) {
      parts.push(`Client ID : ${policydetailedlist?.client?.clientCode || policydetailedlist?.client?.generatedClientId || policydetailedlist?.ClientId}`);
    }

    return parts.join(" / ") || t("endorsement.client");
  }, [clientName, clientId, policydetailedlist?.ClientId, t]);

  // Show error if no policy ID in URL
  if (!id) {
    return (
      <div className="endorsement__personal__detail__change__container">
        <div className="customer__info__main__title">{t("endorsement.clients")}</div>
        <Card className="mt-4">
          <div className="p-4 text-center">
            <h3>{t("endorsement.noPolicySelected")}</h3>
            <p>{t("endorsement.pleaseSelectPolicy")}</p>
            <Button
              label={t("endorsement.goBack")}
              onClick={() => navigate(-1)}
              className="mt-3"
            />
          </div>
        </Card>
      </div>
    );
  }

  // Show loading state while fetching policy details
  if (!policydetailedlist) {
    return (
      <div className="endorsement__personal__detail__change__container">
        <div className="customer__info__main__title">{t("endorsement.clients")}</div>
        <Card className="mt-4">
          <div className="p-4 text-center">{t("endorsement.loadingPolicyDetails")}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="endorsement__personal__detail__change__container">
      <CustomToast ref={toastRef} message={t("endorsement.endorsementCreated")} />
      <div className="customer__info__main__title">{t("endorsement.clients")}</div>
      <div className="customer__info__back__btn mt-3">
        <div
          className="customer__info__back__btn__title cursor-pointer"
          onClick={handleClientViewNavigation}
        >
          <span className="cursor-poiter icon__container">
            <SvgLeftArrow />
          </span>
          {displayTitle}
        </div>
      </div>
      <Card className="mt-4">
        <div className="customer__info__title">
          {t("endorsement.endorsementRequest")}
          {(endorsementTypeSet.has("5") || endorsementTypeSet.has("fire_cancel")) && (
            <span className="text-red-500">{" - "}{t("endorsement.cancelPolicy")}</span>
          )}
        </div>
        {(endorsementTypeSet.has("1") || endorsementTypeSet.has("5")) && (
          <PersonalDetailsChange
            index={1}
            disabled={endorsementTypeSet.has("5")}
            shouldSubmit={submitTargetIndex === 1}
            onSectionSubmitted={handleSectionSubmitted}
            onSectionInvalid={handleSectionInvalid}
            personalDetails={personalDetailsData}
          />
        )}
        {(endorsementTypeSet.has("2") || endorsementTypeSet.has("5")) && (
          <MotorDetailsChange
            index={2}
            disabled={endorsementTypeSet.has("5")}
            shouldSubmit={submitTargetIndex === 2}
            onSectionSubmitted={handleSectionSubmitted}
            personalDetails={motorDetailsData}
          />
        )}
        {(endorsementTypeSet.has("3") || endorsementTypeSet.has("5")) && (
          <CoverageChange
            index={3}
            disabled={endorsementTypeSet.has("5")}
            shouldSubmit={submitTargetIndex === 3}
            onSectionSubmitted={handleSectionSubmitted}
            vehicleType={
              policydetailedlist?.vehicleType ||
              policydetailedlist?.insuranceVehicleDetails?.[0]?.vehicleType ||
              ""
            }
            seatingCapacity={
              policydetailedlist?.insuranceVehicleDetails?.[0]?.seatingCapacity ||
              policydetailedlist?.seatingCapacity
            }
            productConfigurator={productConfigurator}
            coverageDetails={coverageDetails}
            setCoverageDetails={setCoverageDetails}
            currentGrossPremium={currentGrossPremium}
          />
        )}
        {(endorsementTypeSet.has("4") || endorsementTypeSet.has("5")) && (
          <PolicyExtend
            index={4}
            disabled={endorsementTypeSet.has("5")}
            shouldSubmit={submitTargetIndex === 4}
            onSectionSubmitted={handleSectionSubmitted}
            policyExtendDetails={policyExtendDetails}
          />
        )}
        {isFire && endorsementTypeSet.has("fire_regular") && (
          <FireDetailsChange
            index="fire_regular"
            disabled={endorsementTypeSet.has("fire_cancel")}
            shouldSubmit={submitTargetIndex === "fire_regular"}
            onSectionSubmitted={handleSectionSubmitted}
            fireDetails={policydetailedlist}
          />
        )}
        {isFire && endorsementTypeSet.has("fire_cancel") && (
          <FireCancellation
            index="fire_cancel"
            disabled={false}
            shouldSubmit={submitTargetIndex === "fire_cancel"}
            onSectionSubmitted={handleSectionSubmitted}
          />
        )}
        <div className="grid mt-3">
          <div className="col-12 p-0">
            <div className="back__next__btn__container">
              <div className="next__btn__container">
                <Button className="next__btn" onClick={handleButtonClick}>
                  {t("endorsement.saveAndNext")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PersonalDetails;
