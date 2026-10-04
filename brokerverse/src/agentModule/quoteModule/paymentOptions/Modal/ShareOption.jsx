import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import "./index.scss";
import SvgWhatsAppIcon from "../../../../assets/agentIcon/SvgWhatsAppIcon";
import SvgEmailIcon from "../../../../assets/agentIcon/SvgEmailIcon";
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
      header="Share"
      style={{ width: "40vw" }}
      className="payment__share__dialog__container"
      onHide={() => setModalVisible(false)}
      dismissableMask={true}
    >
      <div className="grid m-0">
        <div className="col-12 submit__container">
          <div>{window.location.href}</div>
          <Button onClick={handleCopyToClipboard}>{t("shareOption.copyLink")}</Button>
        </div>
        <div className="share__option__area">
          <div className="common__div mb-2 cursor-pointer">
            <SvgEmailIcon />
          </div>
          <div className="share__option_caption">Email</div>
        </div>
        <div className="share__option__area">
          <div className="common__div mb-2 cursor-pointer">
            <SvgWhatsAppIcon />
          </div>
          <div className="share__option_caption">WhatsApp</div>
        </div>
      </div>
    </Dialog>
  );
};

export default ShareOption;
