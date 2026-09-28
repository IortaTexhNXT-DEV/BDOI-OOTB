import React from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { FileUpload } from "primereact/fileupload";
import SvgImageUpload from "../../../../assets/icons/SvgImageUpload";
import { Button } from "primereact/button";
import "./index.scss";
import SvgUploadClose from "../../../../assets/agentIcon/SvgUploadClose";

const DocumentUpload = ({
  modalVisible,
  handleUppendImg,
  uploadImage,
  fileUploadRef,
  handleSubmit,
  handleCancelUplaoded,
  setModalVisible,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog
      visible={modalVisible}
      header={t("agent.uploadDocument")}
      style={{ width: "80vw" }}
      className="paymet__options__document__upload__container"
      onHide={() => setModalVisible(false)}
      dismissableMask={true}
    >
      <div className="grid m-0">
        <div className="col-12 p-0">
          <div className="file_icon_selector">
            <FileUpload
              ref={fileUploadRef}
              url="./upload"
              auto
              customUpload
              mode="basic"
              name="demo"
              accept=".png,.jpg,.jpeg,.pdf"
              maxFileSize={2000000}
              uploadHandler={(e) => {
                handleUppendImg(e.options.props.name, e.files[0]);
                // Clear FileUpload queue to prevent component from staying in processing state (fixes freeze)
                fileUploadRef?.current?.clear();
              }}
            />
            <div className="icon_click_option">
              <SvgImageUpload />
            </div>
            <div className="upload__caption text-center">{t("agent.upload")}</div>
            <div className="upload__caption text-center">
              {t("agent.maxFileSizePdf")}
            </div>
          </div>
        </div>
        {uploadImage && (
          <div className="col-12 p-0 mt-2">
            <span onClick={handleCancelUplaoded}>
              <SvgUploadClose />
            </span>
          </div>
        )}
        <div className="col-12 p-0 submit__container flex justify-content-end">
          <Button onClick={handleSubmit}>{t("agent.submit")}</Button>
        </div>
      </div>
    </Dialog>
  );
};

export default DocumentUpload;
