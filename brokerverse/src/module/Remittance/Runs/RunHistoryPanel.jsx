import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import RunHistoryTable from "./RunHistoryTable";

/** Run history of a schedule as a side panel (900px); also opened from the Remittances run strip. */
const RunHistoryPanel = ({ visible, onHide, schedule }) => {
  const { t } = useTranslation();
  return (
    <Dialog visible={visible} onHide={onHide} header={t("remittance.runHistory.title", { code: schedule?.code || "" })} modal draggable={false} resizable={false}
      style={{ width: "900px" }} breakpoints={{ "960px": "100vw" }} className="rm-panel"
      footer={<Button type="button" label={t("remittance.common.close")} outlined onClick={onHide} />}>
      {visible && schedule ? <RunHistoryTable scheduleId={schedule.id} /> : null}
    </Dialog>
  );
};

RunHistoryPanel.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  /** { id, code } */
  schedule: PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), code: PropTypes.string }),
};

RunHistoryPanel.defaultProps = { visible: false, schedule: null };

export default RunHistoryPanel;
