import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import ImportDialog from "../../../components/ImportDialog";
import talkbotService from "../../../services/talkbotService";

/** The refusal of a file of another Talkbot task: the user may load it anyway. */
const TASK_NAME_DIFFERS = "TASK_NAME_DIFFERS";

/**
 * Upload Talkbot results (FR-TBT-010): the Call Records export of the Talkbot platform, on a call list Sent to Talkbot
 * or with results already loaded. Opened from a call list, the list is fixed; from Talkbot Calls the user picks it.
 * A file of another Talkbot task is loaded only after the user confirms.
 */
const UploadResultsDialog = ({ visible, onHide, list, onDone }) => {
  const { t } = useTranslation();
  const [lists, setLists] = useState([]);
  const [chosenId, setChosenId] = useState(null);
  const fixedId = list?.id || null;

  useEffect(() => {
    if (!visible) return;
    setChosenId(fixedId);
    if (!fixedId) talkbotService.lists({ status: "sent,results-loaded", pageSize: 100 }).then((r) => setLists(r.data || [])).catch(() => setLists([]));
  }, [visible, fixedId]);

  // the target changes only with the list chosen: a reload of the call list behind the dialog keeps the result shown
  const targets = useMemo(() => [{ label: "", templatePath: talkbotService.templatePath, uploadPath: chosenId ? talkbotService.resultsPath(chosenId) : "" }], [chosenId]);
  const confirmRetry = (e) => {
    const refusal = (e.errors || []).find((x) => x.code === TASK_NAME_DIFFERS);
    if (!refusal) return null;
    return {
      dialog: { title: t("talkbot.upload.otherTask"), severity: "warning", message: refusal.message, confirmLabel: t("talkbot.upload.loadAnyway") },
      fields: { confirmTaskName: "true" },
    };
  };

  const steps = [{
    key: "list",
    label: t("talkbot.upload.callList"),
    node: list ? (
      <span>{[list.listNumber, list.taskName].filter(Boolean).join(" · ")}</span>
    ) : (
      <Dropdown inputId="tb-upload-list" value={chosenId} className="w-full" placeholder={t("talkbot.upload.chooseList")} aria-label={t("talkbot.upload.callList")}
        options={lists.map((l) => ({ label: [l.listNumber, l.taskName].filter(Boolean).join(" · "), value: l.id }))}
        onChange={(e) => setChosenId(e.value || null)} emptyMessage={t("talkbot.upload.noList")} />
    ),
  }];

  return (
    <ImportDialog visible={visible} onHide={onHide} title={t("talkbot.upload.title")} targets={targets} steps={steps} fieldsReady={!!chosenId}
      help={t("talkbot.upload.help")} confirmRetry={confirmRetry} onDone={onDone} loadLabel={t("talkbot.upload.upload")} />
  );
};

UploadResultsDialog.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  /** the call list the dialog is opened from ({ id, listNumber, taskName }); null: the user picks one */
  list: PropTypes.shape({ id: PropTypes.string, listNumber: PropTypes.string, taskName: PropTypes.string }),
  onDone: PropTypes.func,
};
UploadResultsDialog.defaultProps = { visible: false, list: null, onDone: null };

export default UploadResultsDialog;
