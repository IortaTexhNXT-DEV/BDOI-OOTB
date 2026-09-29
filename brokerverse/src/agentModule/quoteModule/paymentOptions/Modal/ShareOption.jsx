import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import "./index.scss";
import SvgWhatsAppIcon from "../../../../assets/agentIcon/SvgWhatsAppIcon";
import SvgEmailIcon from "../../../../assets/agentIcon/SvgEmailIcon";
import logger from "../../../../utility/logger";

const ShareOption = ({ modalVisible, setModalVisible }) => {
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (err) {
      logger.error(err);
    }
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
          <Button onClick={handleCopyToClipboard}>Copy</Button>
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
