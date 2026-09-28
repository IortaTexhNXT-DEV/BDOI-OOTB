import React, { useEffect, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import collectionService from "../../../services/collectionService";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { formatDate } from "@fullcalendar/core/index.js";

const FollowUpModal = ({
  loadingFollowUp,
  collection,
  visible,
  onHide,
  collectionId,
  actionType,
  onSaved,
  handleSendEmail,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    notes: "",
    callOutcome: "",
    commitmentDate: null,
  });

  useEffect(() => {
    if (actionType === "Email") {
      setFormData({
        notes: `Dear ${collection.client.firstName} ${
          collection.client.lastName
        },

I hope this message finds you well.
This is to inform you that the payment for policy number : ${
          collection.policy.policyNumber
        } amounting to ${
          collection.outstandingAmount
        } is due as of ${formatDate(
          collection.dueDate
        )}. We request you to kindly arrange for the payment at the earliest to ensure uninterrupted service and timely policy processing.
 
  Best regards,
  Team Brokerverse`,
        callOutcome: "",
        commitmentDate: null,
      });
    }
  }, [actionType]);

  const [saving, setSaving] = useState(false);

  const callOutcomeOptions = [
    { label: "Answered - Promised Payment", value: "Answered" },
    { label: "No Answer", value: "NoAnswer" },
    { label: "Wrong Number", value: "WrongNumber" },
    { label: "Callback Requested", value: "CallbackRequested" },
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const actionData = {
        actionType,
        notes: formData.notes,
        callOutcome: actionType === "Call" ? formData.callOutcome : null,
        commitmentDate:
          actionType === "Commitment" ? formData.commitmentDate : null,
      };

      if (actionType === "Commitment") {
        await collectionService.setCommitmentDate(
          collectionId,
          formData.commitmentDate,
          formData.notes
        );
      } else {
        await collectionService.addFollowUpAction(collectionId, actionData);
      }

      setFormData({ notes: "", callOutcome: "", commitmentDate: null });
      onSaved();
    } catch (error) {
      console.error("Save follow-up error:", error);
      alert("Failed to save follow-up action");
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => {
    switch (actionType) {
      case "Email":
        return (
          <div className="follow-up-form">
            <div className="form-field">
              <label>Email Content / Notes:</label>
              <InputTextarea
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={5}
                placeholder="Enter email content or notes about the email sent..."
              />
            </div>
          </div>
        );

      case "Call":
        return (
          <div className="follow-up-form">
            <div className="form-field">
              <label>Call Outcome:</label>
              <Dropdown
                value={formData.callOutcome}
                options={callOutcomeOptions}
                onChange={(e) => handleInputChange("callOutcome", e.value)}
                placeholder={t("agent.selectOutcome")}
              />
            </div>
            <div className="form-field">
              <label>Call Notes:</label>
              <InputTextarea
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={5}
                placeholder="Enter notes about the call..."
              />
            </div>
          </div>
        );

      case "Note":
        return (
          <div className="follow-up-form">
            <div className="form-field">
              <label>Notes:</label>
              <InputTextarea
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={5}
                placeholder="Enter notes..."
              />
            </div>
          </div>
        );

      case "Commitment":
        return (
          <div className="follow-up-form">
            <div className="form-field">
              <label>Commitment Date:</label>
              <Calendar
                value={formData.commitmentDate}
                onChange={(e) => handleInputChange("commitmentDate", e.value)}
                minDate={new Date()}
                showIcon
                dateFormat="yy-mm-dd"
              />
            </div>
            <div className="form-field">
              <label>Reason for Delay:</label>
              <InputTextarea
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={4}
                placeholder="Enter reason for payment delay..."
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const footer = (
    <div>
      <Button
        label={t("common.cancel")}
        icon="pi pi-times"
        onClick={onHide}
        className="p-button-text"
      />
      {actionType === "Email" ? (
        <Button
          label={t("agent.sendEmail")}
          icon="pi pi-send"
          onClick={() => handleSendEmail(formData.notes)}
          loading={loadingFollowUp}
        />
      ) : (
        <Button
          label={t("common.save")}
          icon="pi pi-check"
          onClick={handleSave}
          loading={saving}
        />
      )}
    </div>
  );

  return (
    <Dialog
      header={`Add Follow-Up: ${actionType}`}
      visible={visible}
      style={{ width: "500px" }}
      footer={footer}
      onHide={onHide}
      className="follow-up-modal"
    >
      {renderContent()}
    </Dialog>
  );
};

export default FollowUpModal;
