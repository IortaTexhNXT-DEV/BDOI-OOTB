import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Message } from 'primereact/message';
import { Toast } from 'primereact/toast';
import { getLeadByIdMiddleware, deleteLeadMiddleware } from '../Store/leadMiddleware';
import { isFireLob, isIarLob } from '../../endorsementModule/constants/endorsementCategories';
import { formatDate as formatConfiguredDate, formatInstant } from '../../../utility/dateFormat';
import ActivityPanel from '../../../components/SalesActivities/ActivityPanel';
import { RFQ_PATH, isUntagged, rfqState } from '../../../module/Sales/salesProducts';
import TagProductDialog from '../leadListing/TagProductDialog';
import confirmDeleteProspect from '../confirmDeleteProspect';
import DetailSection from '../../../components/DetailSection';
import { RecordActivityLog } from '../../../components/ActivityLog';
import './index.scss';

const LeadDetail = () => {
  const { t } = useTranslation();
  // a fact's label as the other detail views show it: no trailing colon
  const label = (key, fallback) => t(key, fallback).replace(/\s*:\s*$/, "");
  const { leadId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = React.useRef(null);
  // 'tag': Tag product; 'quote': the product asked for before the first quotation of a prospect without one
  const [tagging, setTagging] = useState(null);

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

  const handleDelete = async () => {
    const deleted = await confirmDeleteProspect({ leadId, ...currentLeadDetails }, async () => {
      const result = await dispatch(deleteLeadMiddleware(leadId));
      if (!result.type.endsWith('/fulfilled')) throw new Error(result.payload || t('leadDetail.failedToDelete'));
    }, t);
    if (!deleted) return;
    toast.current.show({
      severity: 'success',
      summary: t('common.success'),
      detail: t('leadDetail.deletedSuccess'),
      life: 3000
    });
    navigate('/agent/leadlisting');
  };

  const handleBack = () => {
    navigate('/agent/leadlisting');
  };

  /**
   * Same entry point as straight after creating the lead: the quote screen of the lead's line of business (the motor
   * quote wizard, the Fire or IAR form), else a Request for Quotation to the insurers. A prospect whose product is not
   * yet tagged is asked for it first.
   */
  const handleCreateQuote = () => {
    if (isUntagged(currentLeadDetails)) setTagging('quote');
    else startQuote(currentLeadDetails);
  };

  const startQuote = (lead) => {
    const id = lead.leadId || leadId;
    const lob = lead.lob;
    if (lob && isIarLob(lob)) {
      navigate('/agent/createlead/iar', { state: { leadRefId: id, leadId: id, isEdit: true } });
      return;
    }
    if (lob && isFireLob(lob)) {
      navigate('/agent/createlead/fire-allied-perils', { state: { leadId: id, isEdit: true } });
      return;
    }
    if (lob && String(lob).toUpperCase() !== 'MOTOR') {
      const product = lead.productType ? { id: lead.productId ?? undefined, name: lead.productType } : null;
      navigate(RFQ_PATH, { state: rfqState(product, { lead: { ...lead, leadId: id } }) });
      return;
    }
    navigate(`/agent/createquote/policydetails/createquote/${id}`, { state: { lead } });
  };

  const handleTagged = (lead) => {
    const next = tagging;
    setTagging(null);
    dispatch(getLeadByIdMiddleware(leadId));
    if (next === 'quote') startQuote(lead);
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
      <TagProductDialog lead={currentLeadDetails} visible={Boolean(tagging)} forQuote={tagging === 'quote'} onHide={() => setTagging(null)} onTagged={handleTagged} />
      
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
            label={currentLeadDetails.lob ? t('productPicker.changeProduct') : t('productPicker.tagProduct')}
            icon="pi pi-tag"
            className="p-button-outlined mr-2"
            onClick={() => setTagging('tag')}
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

      {isUntagged(currentLeadDetails) && <Message severity="warn" className="w-full justify-content-start mb-3" text={t('productPicker.untaggedNote')} />}

      <div className="grid">
        <div className="col-12 md:col-6">
          <Card className="detail-card">
            <h3>{t('leadDetail.personalInformation')}</h3>
            <div className="detail-row">
              <span className="label">{label('leadDetail.leadIdLabel')}</span>
              <span className="value">{currentLeadDetails.generatedLeadId || currentLeadDetails.leadId || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.category')}</span>
              <span className="value">{currentLeadDetails.leadCategory || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('productPicker.lineAndProduct')}</span>
              <span className="value">
                {currentLeadDetails.lob
                  ? [...new Set([currentLeadDetails.lob, currentLeadDetails.productName || currentLeadDetails.productType].filter(Boolean)
                    .map((v) => String(v).trim()).map((v, i, all) => (all.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i ? v : null)).filter(Boolean))].join(' · ')
                  : t('productPicker.untagged')}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.firstName')}</span>
              <span className="value">{currentLeadDetails.firstName || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.lastName')}</span>
              <span className="value">{currentLeadDetails.lastName || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.preferredName')}</span>
              <span className="value">{currentLeadDetails.preferredName || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.dateOfBirth')}</span>
              <span className="value">{formatDate(currentLeadDetails.DOB)}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.gender')}</span>
              <span className="value">{currentLeadDetails.gender || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.email')}</span>
              <span className="value">{currentLeadDetails.emailId || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.contactNumber')}</span>
              <span className="value">{currentLeadDetails.contactNumber || t('policyDetail.nA')}</span>
            </div>
          </Card>
        </div>

        <div className="col-12 md:col-6">
          <Card className="detail-card">
            <h3>{t('leadDetail.addressInformation')}</h3>
            <div className="detail-row">
              <span className="label">{label('leadDetail.houseNo')}</span>
              <span className="value">{currentLeadDetails.houseNo || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('address.street')}</span>
              <span className="value">{currentLeadDetails.street || currentLeadDetails.roadThanon || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.barangay')}</span>
              <span className="value">{currentLeadDetails.barangay || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.city')}</span>
              <span className="value">{currentLeadDetails.city || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.province')}</span>
              <span className="value">{currentLeadDetails.province || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('address.region')}</span>
              <span className="value">{currentLeadDetails.region || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.country')}</span>
              <span className="value">{currentLeadDetails.country || t('policyDetail.nA')}</span>
            </div>
            <div className="detail-row">
              <span className="label">{label('leadDetail.zipCode')}</span>
              <span className="value">{currentLeadDetails.zipCode || t('policyDetail.nA')}</span>
            </div>
          </Card>
        </div>

        {currentLeadDetails.leadCategory === 'Corporate' && (
          <div className="col-12 md:col-6">
            <Card className="detail-card">
              <h3>{t('leadDetail.companyInformation')}</h3>
              <div className="detail-row">
                <span className="label">{label('leadDetail.companyName')}</span>
                <span className="value">{currentLeadDetails.companyName || t('policyDetail.nA')}</span>
              </div>
              <div className="detail-row">
                <span className="label">{label('leadDetail.taxInfoNumber')}</span>
                <span className="value">{currentLeadDetails.taxInformationNumber || t('policyDetail.nA')}</span>
              </div>
            </Card>
          </div>
        )}

        <div className="col-12 md:col-6">
            <Card className="detail-card">
              <h3>{t('leadDetail.systemInformation')}</h3>
              <div className="detail-row">
                <span className="label">{label('leadDetail.createdDate')}</span>
                <span className="value">{formatInstant(currentLeadDetails.createdAt, { empty: t('policyDetail.nA') })}</span>
              </div>
              <div className="detail-row">
                <span className="label">{label('leadDetail.lastUpdated')}</span>
                <span className="value">{formatInstant(currentLeadDetails.updatedAt, { empty: t('policyDetail.nA') })}</span>
              </div>
              <div className="detail-row">
                <span className="label">{label('leadDetail.numberOfQuotes')}</span>
                <span className="value">{currentLeadDetails.quotationsCount || '0'}</span>
              </div>
            </Card>
        </div>

        <div className="col-12">
          <ActivityPanel entity="lead" recordId={String(currentLeadDetails.leadId || leadId)} />
        </div>

        <div className="col-12">
          <DetailSection title={t('leadDetail.history')}>
            <RecordActivityLog entity="lead" recordId={currentLeadDetails.leadId || leadId} />
          </DetailSection>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;