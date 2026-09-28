import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import customHistory from "../../../routes/customHistory";
import { useDispatch } from "react-redux";
import S3FileUpload from "../../../components/S3FileUpload";
import { getQuotationByIdMiddleware } from "../Store/quotationMiddleware";
import quotationService from "../../../services/quotationService";
import policyService from "../../../services/policyService";
import { Toast } from "primereact/toast";
import leadService from "../../../services/leadService";

/** Upload folder -> vehicle photo slot. */
const PHOTO_KEY = { left: "leftSide", right: "rightSide", front: "front", rear: "rear", interior: "interior" };

const UploadVehiclePhotos = () => {
  const { t } = useTranslation();
  // S3 URLs for uploaded photos
  const [vehiclePhotos, setVehiclePhotos] = useState({
    leftSide: null,
    rightSide: null,
    front: null,
    rear: null,
    interior: null
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = React.useRef(null);

  const navigate = useNavigate();
  const { state } = useLocation();
  const { quotationId } = useParams();
  const dispatch = useDispatch();
  
  // State for quotation details and customer info
  const [quotationDetails, setQuotationDetails] = useState(state?.quotation || null);
  const [customerInfo, setCustomerInfo] = useState(state?.customerInfo || null);
  const [existingPolicy, setExistingPolicy] = useState(state?.policyData || null);
  const [leadData, setLeadData] = useState(null);
  
  // Load quotation details if not in state
  useEffect(() => {
    const loadQuotation = async () => {
      if (!quotationId) {
        return;
      }

      setIsLoading(true);

      try {
        const data = await dispatch(getQuotationByIdMiddleware(quotationId)).unwrap();
        setQuotationDetails(data);

        // Load vehicle photos from quotation if they exist
        if (data) {
          setVehiclePhotos({
            leftSide: data.vehicleLeftSidePhoto || null,
            rightSide: data.vehicleRightSidePhoto || null,
            front: data.vehicleFrontSidePhoto || null,
            rear: data.vehicleRearSidePhoto || null,
            interior: data.vehicleInteriorDashboardPhoto || null,
          });
        }
      } catch (error) {
        console.error('Failed to load quotation:', error);
        toast.current?.show({
          severity: 'error',
          summary: t('common.error'),
          detail: t('agent.failedToLoadQuotationDetails'),
          life: 5000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (!quotationDetails && quotationId) {
      loadQuotation();
    }
  }, [quotationId, quotationDetails, dispatch]);

  useEffect(() => {
    const resolveExistingPolicy = async () => {
      if (!quotationId || existingPolicy) {
        return;
      }

      setIsLoading(true);

      try {
        const response = await policyService.getPolicies(1, 1, { quoteRefId: quotationId });
        if (response.success && Array.isArray(response.data?.data) && response.data.data.length > 0) {
          setExistingPolicy(response.data.data[0]);
        }
      } catch (error) {
        console.error('Failed to resolve existing policy for vehicle photos screen:', error);
      } finally {
        setIsLoading(false);
      }
    };

    resolveExistingPolicy();
  }, [existingPolicy, quotationId]);

  // Fetch lead data when quotation details are loaded
  useEffect(() => {
    const fetchLeadData = async () => {
      if (quotationDetails?.leadRefId) {
        console.log("Fetching lead data for leadRefId:", quotationDetails.leadRefId);
        try {
          const response = await leadService.getLeadById(quotationDetails.leadRefId);
          if (response.success) {
            console.log("Lead data fetched successfully:", response.data);
            setLeadData(response.data);
          } else {
            console.error("Failed to fetch lead data:", response.error);
          }
        } catch (error) {
          console.error("Error fetching lead data:", error);
        }
      }
    };

    fetchLeadData();
  }, [quotationDetails?.leadRefId]);

  const handlePhotoUpload = (position, url) => {
    console.log(`Uploaded ${position} photo:`, url);
    setVehiclePhotos(prev => ({
      ...prev,
      [position]: url
    }));
  };

  const handleBackNavigation = () => {
    customHistory.back();
  };

  const handleSubmit = async () => {
    const hasAnyPhoto = Object.values(vehiclePhotos).some((url) => url !== null);

    if (!hasAnyPhoto) {
      toast.current?.show({
        severity: 'warn',
        summary: t("agent.noPhotos"),
        detail: t("agent.uploadAtLeastOnePhoto"),
        life: 3000,
      });
      return;
    }

    if (!quotationId) {
      toast.current?.show({
        severity: 'error',
        summary: t("common.error"),
        detail: t("agent.quotationIdMissing"),
        life: 3000,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Vehicle photos uploaded:', vehiclePhotos);
      console.log('Customer info from previous step:', customerInfo);

      // Show loading toast
      toast.current?.show({
        severity: 'info',
        summary: t('agent.saving'),
        detail: t('agent.savingVehiclePhotos'),
        life: 2000,
      });

      // Prepare vehicle photos for API
      const vehiclePhotosData = {
        vehicleLeftSidePhoto: vehiclePhotos.leftSide,
        vehicleRightSidePhoto: vehiclePhotos.rightSide,
        vehicleFrontSidePhoto: vehiclePhotos.front,
        vehicleRearSidePhoto: vehiclePhotos.rear,
        vehicleInteriorDashboardPhoto: vehiclePhotos.interior,
      };

      // Update quotation with vehicle photos
      const result = await quotationService.updateQuotationVehicleInfo(
        quotationId,
        vehiclePhotosData,
        'agent'
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to save vehicle photos');
      }

      // Update quotation details with the returned data
      if (result.data?.data) {
        setQuotationDetails(result.data.data);
      }

      toast.current?.show({
        severity: 'success',
        summary: t("common.success"),
        detail: t("agent.vehiclePhotosSavedSuccess"),
        life: 2000,
      });

      // Navigate to next step after a brief delay
      setTimeout(() => {
        navigate(`/agent/coveragedetailedview/${quotationId}`, {
          state: {
            ...state,
            quotation: result.data?.data || quotationDetails,
            customerInfo,
            vehiclePhotos,
            policyData: existingPolicy,
          },
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to save vehicle photos:', error);
      toast.current?.show({
        severity: 'error',
        summary: t("common.error"),
        detail: error.message || t("agent.failedToSaveVehiclePhotos"),
        life: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };
  return (
    <div className="upload__vehicle__container">
      <Toast ref={toast} />
      <div className="customer__info__main__title">{t("agent.leads")}</div>
      <div className="customer__info__back__btn mt-3">
        <div className="customer__info__back__btn__title">
          <div onClick={handleLeadNavigation} className="cursor-pointer arrow__outer">
            <span className="icon__container">
              <SvgLeftArrow />
            </span>
            {leadData
              ? `${leadData.firstName || ""} ${leadData.lastName || ""} / ${t("agent.leadIdLabel")} ${leadData.generatedLeadId || ""}`
              : quotationDetails?.leadRefId
              ? `${t("agent.leadIdLabel")} ${quotationDetails.leadRefId}`
              : t("agent.loadingLeadData")}
          </div>
        </div>
        <div className="customer__info__quote__title">
          Quote ID: {quotationDetails?.quotationNumber || 'Loading...'}
        </div>
      </div>
      <Card className="mt-4">
        <div className="customer__info__title">{t("agent.convertPolicy")}</div>
        <div className="customer__info__subtitle mt-2 mb-2">
          {t("agent.uploadVehiclePhotos")}
        </div>
        <div class="grid m-0">
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <div className="upload__label mb-2">{t("agent.vehicleLeftSidePhoto")}</div>
            <S3FileUpload
              accept="image/*"
              maxFileSize={5 * 1024 * 1024} // 5MB
              multiple={false}
              showPreview={true}
              autoUpload
              uploadPath="vehicle-photos/left"
              onRemove={() => handlePhotoUpload(PHOTO_KEY["left"], null)}
              onUploadSuccess={(url) => handlePhotoUpload('leftSide', url)}
              onUploadError={(error) => console.error('Left photo upload error:', error)}
            />
            {vehiclePhotos.leftSide && (
              <div className="text-sm text-green-600 mt-2">
                ✓ {t("agent.photoUploadedSuccessfully")}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <div className="upload__label mb-2">{t("agent.vehicleRightSidePhoto")}</div>
            <S3FileUpload
              accept="image/*"
              maxFileSize={5 * 1024 * 1024}
              multiple={false}
              showPreview={true}
              autoUpload
              uploadPath="vehicle-photos/right"
              onRemove={() => handlePhotoUpload(PHOTO_KEY["right"], null)}
              onUploadSuccess={(url) => handlePhotoUpload('rightSide', url)}
              onUploadError={(error) => console.error('Right photo upload error:', error)}
            />
            {vehiclePhotos.rightSide && (
              <div className="text-sm text-green-600 mt-2">
                ✓ Photo uploaded successfully
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <div className="upload__label mb-2">Vehicle Front Photo</div>
            <S3FileUpload
              accept="image/*"
              maxFileSize={5 * 1024 * 1024}
              multiple={false}
              showPreview={true}
              autoUpload
              uploadPath="vehicle-photos/front"
              onRemove={() => handlePhotoUpload(PHOTO_KEY["front"], null)}
              onUploadSuccess={(url) => handlePhotoUpload('front', url)}
              onUploadError={(error) => console.error('Front photo upload error:', error)}
            />
            {vehiclePhotos.front && (
              <div className="text-sm text-green-600 mt-2">
                ✓ {t("agent.photoUploadedSuccessfully")}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <div className="upload__label mb-2">{t("agent.vehicleRearPhoto")}</div>
            <S3FileUpload
              accept="image/*"
              maxFileSize={5 * 1024 * 1024}
              multiple={false}
              showPreview={true}
              autoUpload
              uploadPath="vehicle-photos/rear"
              onRemove={() => handlePhotoUpload(PHOTO_KEY["rear"], null)}
              onUploadSuccess={(url) => handlePhotoUpload('rear', url)}
              onUploadError={(error) => console.error('Rear photo upload error:', error)}
            />
            {vehiclePhotos.rear && (
              <div className="text-sm text-green-600 mt-2">
                ✓ {t("agent.photoUploadedSuccessfully")}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <div className="upload__label mb-2">{t("agent.vehicleInteriorPhoto")}</div>
            <S3FileUpload
              accept="image/*"
              maxFileSize={5 * 1024 * 1024}
              multiple={false}
              showPreview={true}
              autoUpload
              uploadPath="vehicle-photos/interior"
              onRemove={() => handlePhotoUpload(PHOTO_KEY["interior"], null)}
              onUploadSuccess={(url) => handlePhotoUpload('interior', url)}
              onUploadError={(error) => console.error('Interior photo upload error:', error)}
            />
            {vehiclePhotos.interior && (
              <div className="text-sm text-green-600 mt-2">
                ✓ {t("agent.photoUploadedSuccessfully")}
              </div>
            )}
          </div>
        </div>
        <div class="grid m-0">
          <div className="col-12 mt-2">
            <div className="back__next__btn__container">
              <div className="back__btn__container">
                <Button className="back__btn" onClick={handleBackNavigation}>
                  {t("common.back", "Back")}
                </Button>
              </div>
              <div className="next__btn__container">
                <Button 
                  className="next__btn" 
                  onClick={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {t("agent.next", "Next")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default UploadVehiclePhotos;

