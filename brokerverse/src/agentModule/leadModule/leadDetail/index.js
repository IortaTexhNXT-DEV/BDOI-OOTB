import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Message } from 'primereact/message';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Toast } from 'primereact/toast';
import { getLeadByIdMiddleware, deleteLeadMiddleware } from '../Store/leadMiddleware';
import { isFireLob, isIarLob } from '../../endorsementModule/constants/endorsementCategories';
import { formatDate as formatConfiguredDate } from '../../../utility/dateFormat';
import PartyPrivacyPanel from '../../../module/DataPrivacy/PartyPrivacyPanel';
import ActivityPanel from '../../../components/SalesActivities/ActivityPanel';
import './index.scss';

const LeadDetail = () => {
  const { t } = useTranslation();
  const { leadId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = React.useRef(null);

  const { currentLeadDetails, loading, error } = useSelector(({ leadReducers }) => ({
    currentLeadDetails: leadReducers?.currentLeadDetails || {},
    loading: leadReducers?.loading || false,
    error: leadReducers?.error || null
  }));

  useEffect(() => {
    if (leadId) {
      dispatch(getLeadByIdMiddleware(leadId));
    }
  }, [dispatch, leadId]);

  const handleEdit = () => {
    navigate(`/agent/leadedit/${leadId}`);
  };

  const handleDelete = () => {
    confirmDialog({
      message: t('leadDetail.confirmDelete'),
      header: t('leadDetail.deleteConfirmation'),
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          const result = await dispatch(deleteLeadMiddleware(leadId));
          if (result.type.endsWith('/fulfilled')) {
            toast.current.show({
              severity: 'success',
              summary: t('common.success'),
              detail: t('leadDetail.deletedSuccess'),
              life: 3000
            });
            navigate('/agent/leadlisting');
          } else {
            toast.current.show({
              severity: 'error',
              summary: t('common.error'),
              detail: result.payload || t('leadDetail.failedToDelete'),
              life: 3000
            });
          }
        } catch (error) {
          toast.current.show({
            severity: 'error',
            summary: t('common.error'),
            detail: t('leadDetail.unexpectedError'),
            life: 3000
          });
        }
      }
    });
  };

  const handleBack = () => {
    navigate('/agent/leadlisting');
  };

  /** Same entry point as straight after creating the lead: the quote wizard for the lead's line of business. */
  const handleCreateQuote = () => {
    const id = currentLeadDetails.leadId || leadId;
    const lob = currentLeadDetails.lob;
    if (lob && isIarLob(lob)) {
      navigate('/agent/createlead/iar', { state: { leadRefId: id, leadId: id, isEdit: true } });
      return;
    }
    if (lob && isFireLob(lob)) {
      navigate('/agent/createlead/fire-allied-perils', { state: { leadId: id, isEdit: true } });
      return;
    }
    navigate(`/agent/createquote/policydetails/createquote/${id}`, { state: { lead: currentLeadDetails } });
  };

  if (loading) {
    return (
      <div className="lead-detail-container">
        <div className="grid">
          <div className="col-12">
            <Card>
              <Skeleton width="100%" height="50px" className="mb-3" />
              <Skeleton width="60%" height="30px" className="mb-2" />
              <Skeleton width="40%" height="30px" className="mb-2" />
              <Skeleton width="70%" height="30px" />
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lead-detail-container">
        <Message
          severity="error"
          text={error}
          className="w-full mb-4"
        />
        <Button
          label={t('leadDetail.backToLeads')}
          icon="pi pi-arrow-left"
          className="p-button-secondary"
          onClick={handleBack}
        />
      </div>
    );
  }

  const formatDate = (dateString) => formatConfiguredDate(dateString, { empty: t('policyDetail.nA') });

  return (
    <div className="lead-detail-container">
      <Toast ref={toast} />
      <ConfirmDialog />
      
      <div className="header">
        <h2>{t('leadDetail.title')}</h2>
        <div className="actions">
          <Button
            label={t('leadDetail.createQuote', 'Create Quote')}
            icon="pi pi-file-edit"
            className="mr-2"
            onClick={handleCreateQuote}
            disabled={!currentLeadDetails.leadId && !leadId}
          />
          <Button
            label={t('leadDetail.edit')}
            icon="pi pi-pencil"
            className="p-button-secondary mr-2"
            onClick={handleEdit}
          />
          <Button
            label={t('leadDetail.delete')}
            icon="pi pi-trash"
            className="p-button-danger mr-2"
            onClick={handleDelete}
          />
          <Button
            label={t('leadDetail.back')}
            icon="pi pi-arrow-left"
            className="p-button-outlined"
            onClick={handleBack}
          />
        </div>
      </div>

      <div className="grid">
        <div className="col-12 md:col-6">
          <Card className="detail-card">
            <h3>{t('leadDetail.personalInformation')}</h3>
            <div className="detail-row">
              <span className="label">{t('leadDetail.leadIdLabel')}</span>
              <span className="value">{currentLeadDetails.generatedLeadId || currentLeadDetails.leadId || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.category')}</span>
              <span className="value">{currentLeadDetails.leadCategory || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.firstName')}</span>
              <span className="value">{currentLeadDetails.firstName || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.lastName')}</span>
              <span className="value">{currentLeadDetails.lastName || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.preferredName')}</span>
              <span className="value">{currentLeadDetails.preferredName || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.dateOfBirth')}</span>
              <span className="value">{formatDate(currentLeadDetails.DOB)}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.gender')}</span>
              <span className="value">{currentLeadDetails.gender || t('policyDetail.nA')}</span>
            </div>
          </Card>
        </div>

        <div className="col-12 md:col-6">
          <Card className="detail-card">
            <h3>{t('leadDetail.contactInformation')}</h3>
            <div className="detail-row">
              <span className="label">{t('leadDetail.email')}</span>
              <span className="value">{currentLeadDetails.emailId || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.contactNumber')}</span>
              <span className="value">{currentLeadDetails.contactNumber || t('policyDetail.nA')}</span>
            </div>
          </Card>
        </div>

        <div className="col-12 md:col-6">
          <Card className="detail-card">
            <h3>{t('leadDetail.addressInformation')}</h3>
            <div className="detail-row">
              <span className="label">{t('leadDetail.houseNo')}</span>
              <span className="value">{currentLeadDetails.houseNo || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('address.street')}</span>
              <span className="value">{currentLeadDetails.street || currentLeadDetails.roadThanon || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.barangay')}</span>
              <span className="value">{currentLeadDetails.barangay || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.city')}</span>
              <span className="value">{currentLeadDetails.city || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.province')}</span>
              <span className="value">{currentLeadDetails.province || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('address.region')}</span>
              <span className="value">{currentLeadDetails.region || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.country')}</span>
              <span className="value">{currentLeadDetails.country || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t('leadDetail.zipCode')}</span>
              <span className="value">{currentLeadDetails.zipCode || t('policyDetail.nA')}</span>
            </div>
          </Card>
        </div>

        {currentLeadDetails.leadCategory === 'Corporate' && (
          <div className="col-12 md:col-6">
            <Card className="detail-card">
              <h3>{t('leadDetail.companyInformation')}</h3>
              <div className="detail-row">
                <span className="label">{t('leadDetail.companyName')}</span>
                <span className="value">{currentLeadDetails.companyName || t('policyDetail.nA')}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t('leadDetail.taxInfoNumber')}</span>
                <span className="value">{currentLeadDetails.taxInformationNumber || t('policyDetail.nA')}</span>
              </div>
            </Card>
          </div>
        )}

        <div className="col-12 md:col-6">
            <Card className="detail-card">
              <h3>{t('leadDetail.systemInformation')}</h3>
              <div className="detail-row">
                <span className="label">{t('leadDetail.createdDate')}</span>
                <span className="value">{formatDate(currentLeadDetails.createdAt)}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t('leadDetail.lastUpdated')}</span>
                <span className="value">{formatDate(currentLeadDetails.updatedAt)}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t('leadDetail.numberOfQuotes')}</span>
                <span className="value">{currentLeadDetails.quotationsCount || '0'}</span>
              </div>
            </Card>
        </div>

        <div className="col-12">
          <Card className="detail-card">
            <PartyPrivacyPanel partyType="lead" partyId={currentLeadDetails.leadId || leadId} />
          </Card>
        </div>

        <div className="col-12">
          <ActivityPanel entity="lead" recordId={String(currentLeadDetails.leadId || leadId)} />
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;