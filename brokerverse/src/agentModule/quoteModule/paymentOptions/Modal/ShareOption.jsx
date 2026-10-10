import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import "./index.scss";
import { useTranslation } from "react-i18next";
import { copyText } from "../../../../utility/clipboard";
import { notifyError, notifySuccess } from "../../../../utility/dialogs";

const ShareOption = ({ modalVisible, setModalVisible }) => {
  const { t } = useTranslation();
  const handleCopyToClipboard = async () => {
    if (await copyText(window.location.href)) notifySuccess(t("shareOption.linkCopied"));
    else notifyError(t("shareOption.copyFailed"));
  };
  return (
    <Dialog
      visible={modalVisible}
      header={t("paymentOptions.shareTitle")}
      style={{ width: "40rem" }}
      breakpoints={{ "768px": "95vw" }}
      className="payment__share__dialog__container"
      onHide={() => setModalVisible(false)}
      dismissableMask={true}
    >
      <div className="grid m-0">
        <div className="col-12 submit__container">
          <div className="payment__share__link">{window.location.href}</div>
          <Button onClick={handleCopyToClipboard}>{t("shareOption.copyLink")}</Button>
        </div>
      </div>
    </Dialog>
  );
};

export default ShareOption;
