import React, { useImperativeHandle, forwardRef, useRef } from "react";
import { Toast } from "primereact/toast";
import "./index.scss";

const CustomToast = forwardRef((props, ref) => {
  const { message, messageType } = props;
  const formatMessage = (Message) => {
    if (!Message) return null;

    const parts = Message?.split(/\s+/) || [];

    const formattedParts = parts.map((part, index) => {
      if (!isNaN(part)) {
        return (
          <span
            key={index}
            style={{
              color: "#29CE00",
              fontFamily: "Nunito, Arial, sans-serif",
              fontSize: "16px",
              fontWeight: 500,
            }}
          >
            {part}
          </span>
        );
      } else {
        return (
          <span
            key={index}
            style={{
              color: "black",
              fontFamily: "Nunito, Arial, sans-serif",
              fontSize: "16px",
              fontWeight: 500,
            }}
          >
            {part}
          </span>
        );
      }
    });

    return formattedParts.reduce((acc, curr) => [acc, " ", curr]);
  };

  const formattedMessage = formatMessage(message);

  useImperativeHandle(ref, () => ({
    // Accepts showToast({ severity, summary, detail }) or showToast(severity, summary, detail).
    showToast(options = {}, positionalSummary, positionalDetail) {
      const opts =
        typeof options === "string"
          ? { severity: options, summary: positionalSummary, detail: positionalDetail }
          : options || {};
      const {
        severity = messageType ? messageType : "success",
        summary,
        detail,
      } = opts;
      const icons = {
        success: "pi pi-check-circle",
        error: "pi pi-times-circle",
        warn: "pi pi-exclamation-triangle",
        info: "pi pi-info-circle",
      };

      toastRef.current.show({
        severity,
        summary,
        // an error never falls back to the screen's success message
        detail: detail || (severity === "error" ? summary : formattedMessage || message),
        icon: `${icons[severity] || icons.success} custom-icon`,
        className: "custom-toast",
      });
    },
  }));

  const toastRef = useRef(null);

  return <Toast ref={toastRef} />;
});

export default CustomToast;
