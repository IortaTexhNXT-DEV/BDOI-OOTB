import React, { useEffect, useMemo, useRef } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import customHistory from "../../../routes/customHistory";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import InputTextField from "../../component/inputText";
import { postaccessoriesMiddleware } from "./store/accessoriesMiddleware";
import { setQuoteAccessories } from "../Store/quotationReducer";
import policyRenewalService from "../../../services/policyRenewalService";
import leadService from "../../../services/leadService";
import { notifyError } from "../../../utility/dialogs";
import logger from "../../../utility/logger";

const Accessories = ({ action, flow }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id: policyId } = useParams();
  const { state } = useLocation();
  const { id: leadRefId } = useParams();

  // Redux selectors
  const { currentQuoteCreation } = useSelector(({ quotationReducers }) => ({
    currentQuoteCreation: quotationReducers?.currentQuoteCreation,
  }));

  // The renewal flow never reuses a quote that is being created or edited elsewhere.
  const isEditMode =
    flow !== "renewal" && (currentQuoteCreation?.isEditMode || false);
  const existingAccessories = currentQuoteCreation?.accessories;
  
  // State for lead/client data
  const [leadData, setLeadData] = React.useState(null);
  const [clientData, setClientData] = React.useState(null);
  
  // Helper function to get form values
  const getFormValues = () => {
    // Use existing accessories from Redux if in edit mode
    if (isEditMode && existingAccessories) {
      return {
        Aircon: existingAccessories.aircon || "",
        Stereo: existingAccessories.stereo || "",
        Magwheels: existingAccessories.magWheels || "",
        Others: existingAccessories.others || "",
        Deductible: existingAccessories.deductible || "",
        Towing: existingAccessories.towing || "",
        RepairLimit: existingAccessories.repairLimit || "",
      };
    }
    // Empty values for create mode
    return {
      Aircon: "",
      Stereo: "",
      Magwheels: "",
      Others: "",
      Deductible: "",
      Towing: "",
      RepairLimit: "",
    };
  };
  
  const initialValue = getFormValues();
  const hasInitialized = useRef(false);
  
  const handleclick = (values) => {
    // Prepare accessories data in proper format
    const accessoriesData = {
      aircon: values.Aircon,
      stereo: values.Stereo,
      magWheels: values.Magwheels,
      others: values.Others,
      deductible: values.Deductible,
      towing: values.Towing,
      repairLimit: values.RepairLimit,
    };

    if (flow === "renewal") {
      // Accessories and limits of the renewal are saved on the policy's open renewal.
      return policyRenewalService
        .saveRenewalWizard(policyId, { accessories: accessoriesData })
        .then((response) => {
          if (!response.success) {
            notifyError(`Could not save the renewal: ${response.error}`);
            return;
          }
          navigate(`/agent/renewalquote/ordersummary/${policyId}`, {
            state: { ...state, policyId, policyData: state?.policyData },
          });
        });
    }
    
    // Save to Redux state
    dispatch(setQuoteAccessories(accessoriesData));
    
    // Also dispatch to old middleware for backward compatibility
    dispatch(postaccessoriesMiddleware(values));
    
    // Determine navigation path
    const currentPath = window.location.pathname;
    const isEditFlow = currentPath.includes('/editquote/');
    const idParam = isEditMode ? currentQuoteCreation.quotationId : leadRefId;
    
    // Navigate to order summary
    if (action === "accessoriescreate") {
      const basePath = isEditFlow ? '/agent/editquote' : '/agent/createquote';
      navigate(`${basePath}/ordersummary/${idParam}`, { 
        state: { ...state } 
      });
    } else {
      const basePath = isEditFlow ? '/agent/editquote' : '/agent/createquote';
      const path = isEditFlow ? 'ordersummary' : 'ordersummaryquote';
      navigate(`${basePath}/${path}/${idParam}`, { 
        state: { ...state } 
      });
    }
  };
  const handleBackNavigation = () => {
    customHistory.back();
  };

  const formik = useFormik({
    initialValues: initialValue,
    enableReinitialize: true, // Allow form to reinitialize when quotation data changes
    // validate: customValidation,
    onSubmit: (values) => {
      handleclick(values);
    },
  });

  // Fetch lead data for normal flow (not renewal)
  useEffect(() => {
    const fetchLeadData = async () => {
      if (flow !== "renewal" && leadRefId) {
        try {
          const response = await leadService.getLeadById(leadRefId);
          if (response.success) {
            setLeadData(response.data);
          } else {
            logger.error("Failed to fetch lead data:", response.error);
          }
        } catch (error) {
          logger.error("Error fetching lead data:", error);
        }
      }
    };

    fetchLeadData();
  }, [flow, leadRefId]);

  // Renewal: prefill from this renewal's saved accessories, else the expiring policy's own
  // quotation / policy data; fields the policy never had stay blank.
  useEffect(() => {
    const fetchRenewalAccessories = async () => {
      if (flow !== "renewal" || !policyId || hasInitialized.current) {
        return;
      }
      const response = await policyRenewalService.getRenewalPrefill(policyId);
      if (!response.success || !response.data) {
        logger.error("Failed to load renewal prefill:", response.error);
        return;
      }
      const prefill = response.data;
      setClientData({ name: prefill.clientName, code: prefill.clientCode });
      const a = prefill.accessories || {};
      const text = (v) => (v === undefined || v === null ? "" : String(v));
      formik.setValues({
        Aircon: text(a.aircon),
        Stereo: text(a.stereo),
        Magwheels: text(a.magWheels),
        Others: text(a.others),
        Deductible: text(a.deductible),
        Towing: text(a.towing),
        RepairLimit: text(a.repairLimit),
      });
      hasInitialized.current = true;
    };

    fetchRenewalAccessories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, policyId]);

  const handleLeadNavigation = () => {
    navigate(-1);
  };

  const displayTitle = useMemo(() => {
    if (flow === "renewal") {
      if (clientData) {
        const parts = [];
        if (clientData.name) {
          parts.push(clientData.name);
        }
        if (clientData.code) {
          parts.push(`Client ID : ${clientData.code}`);
        }
        return parts.join(" / ") || "Client";
      }
      return "Loading client data...";
    } else {
      if (leadData) {
        const parts = [];
        if (leadData.firstName || leadData.lastName) {
          parts.push(`${leadData.firstName || ""} ${leadData.lastName || ""}`.trim());
        }
        if (leadData.generatedLeadId) {
          parts.push(`Lead ID : ${leadData.generatedLeadId}`);
        }
        return parts.join(" / ") || "Lead";
      }
      return leadRefId ? `${t("agent.leadIdLabel")} ${leadRefId}` : t("agent.loadingLeadData");
    }
  }, [flow, clientData, leadData, leadRefId]);

  return (
    <div className="overall__create__quote__accessories">
      <div className="header__title">
        {flow === "renewal" ? t("agent.client") : t("agent.leads")}
      </div>
      <div
        onClick={handleLeadNavigation}
        className="left__arrow mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="left__arrow__text">
          {displayTitle}
        </div>
      </div>
      <form onSubmit={formik.handleSubmit}>
        <Card className="mt-4">
          <div className="table__header">
            {flow === "renewal" ? t("agent.renewalDetails") : t("agent.createQuote")}
          </div>
          <div className="sub__heading mt-2 mb-2">Accessories</div>
          <div class="grid mt-2">
            <div class="col-6">
              <InputTextField
                label={t("agent.aircon")}
                value={formik.values.Aircon}
                onChange={formik.handleChange("Aircon")}
              />

              {formik.touched.aircon && formik.errors.aircon && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.aircon}
                </div>
              )}
            </div>
            <div class="col-6">
              <InputTextField
                label={t("agent.stereo")}
                value={formik.values.Stereo}
                onChange={formik.handleChange("Stereo")}
              />
              {formik.touched.stereo && formik.errors.stereo && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.stereo}
                </div>
              )}
            </div>
          </div>

          <div className="grid mt-2">
            <div class="col-6">
              <InputTextField
                label={t("agent.magWheels")}
                value={formik.values.Magwheels}
                onChange={formik.handleChange("Magwheels")}
              />
              {formik.touched.magWheels && formik.errors.magWheels && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.magWheels}
                </div>
              )}
            </div>
            <div class="col-6">
              <InputTextField
                label={t("agent.othersLabel")}
                value={formik.values.Others}
                onChange={formik.handleChange("Others")}
              />
              {formik.touched.others && formik.errors.others && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.others}
                </div>
              )}
            </div>
          </div>
          <div className="sub__heading mt-2 mb-2">Policy Limits</div>
          <div class="grid mt-2">
            <div class="col-6">
              <InputTextField
                label={t("agent.deductible")}
                value={formik.values.Deductible}
                onChange={formik.handleChange("Deductible")}
              />
              {formik.touched.deductible && formik.errors.deductible && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.deductible}
                </div>
              )}
            </div>
            <div class="col-6">
              <InputTextField
                label={t("agent.towing")}
                value={formik.values.Towing}
                onChange={formik.handleChange("Towing")}
              />
              {formik.touched.towing && formik.errors.towing && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.towing}
                </div>
              )}
            </div>
          </div>
          <div class="grid mt-2">
            <div class="col-6">
              <InputTextField
                label="Repair Limit"
                value={formik.values.RepairLimit}
                onChange={formik.handleChange("RepairLimit")}
              />
              {formik.touched.repairLimit && formik.errors.repairLimit && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.repairLimit}
                </div>
              )}
            </div>
          </div>
          <div class="grid mt-2">
            <div className="back__button__container col-12 md:col-12 lg:col-12">
              <div className="back__text__container">
                <Button
                  type="button"
                  label={t("agent.back")}
                  className="back__btn"
                  onClick={handleBackNavigation}
                />
              </div>
              <div className="next__text__container">
                <Button type="submit" label={t("agent.next")} className="next__btn" />
              </div>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default Accessories;
