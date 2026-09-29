import React, { useEffect, useState } from "react";
import Cardcomponent from "../Cardcomponent";
import "./index.scss";
import SvgPhoneIcon from "../../Assets/Icon/SvgPhoneIcon";
import SvgEmailIcon from "../../Assets/Icon/SvgEmailIcon";
import SvgDeleteIcon from "../../Assets/Icon/SvgDeleteIcon";
import SvgArrowClientIcon from "../../Assets/Icon/SvgArrowClientIcon";
import SvgIconWithText from "../SvgIconWithText";
import { Dialog } from "primereact/dialog";
import { useTranslation } from "react-i18next";

const Client = ({
  backgroundColor,
  clientName,
  clientEmail,
  clientPhone,
  clientEmailSubject,
  clientEmailbody,
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const recipientEmail = `${clientEmail}`;
  const subject = `${clientEmailSubject}`;
  const content = `${clientEmailbody}`;

  const encodedContent = encodeURIComponent(content);
  const encodedSubject = encodeURIComponent(subject);
  const composeEmail = () => {
    const fullGmailURL = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipientEmail}&su=${encodedSubject}&body=${encodedContent}`;
    window.open(fullGmailURL, "_blank");
  };

  const handleSinglesubmit = async () => {
    const response = await fetch("https://orange-ardith-70.tiiny.site");
    const blob = await response.blob();
    const file = new File([blob], "share.pdf", { type: blob.type });
    if (navigator.share) {
      await navigator
        .share({
          title: "Share PDF",
          text: "Check out this PDF",
          files: [file],
        })
        .then(() => console.log("Successful share"))
        .catch((error) => console.log("Error in sharing", error));
    } else {
      console.log("System does not support sharing files.");
    }
  };

  const handleOnSubmit = async () => {
    const pdfUrls = [
      "https://orange-ardith-70.tiiny.site",
      "https://orange-ardith-70.tiiny.site",
      "https://orange-ardith-70.tiiny.site",
    ];

    if (navigator.share) {
      const sharedFiles = [];
      for (const url of pdfUrls) {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `pdf_${pdfUrls.indexOf(url) + 1}.pdf`, {
          type: blob.type,
        });

        sharedFiles.push(file);
      }
      const textToShare = t("shared.checkOutThese");
      await navigator
        .share({
          title: t("shared.sharePdf"),
          text: textToShare,
          files: sharedFiles,
        })
        .then((res) => console.log(res, "Successful share"))
        .catch((error) => console.log("Error in sharing", error));
    } else {
      console.log("System does not support sharing files.");
    }
  };

  return (
    <div className="m-0 p-0 client__container">
      <Cardcomponent
        width="116px"
        height="118px"
        isCurved={true}
        showContentText={true}
        useTextColor={true}
        backgroundColor={backgroundColor}
      >
        <div className="card__header pr-3 pl-3 pt-2 pb-2">
          <div className="card__name">{clientName}</div>
          <div className="grid ">
            <div className="col-6 md:col-4 lg:col-4 icons">
              <div className="icons__view">
                <a href={`tel:${clientPhone}`}>
                  <SvgIconWithText
                    icon={<SvgPhoneIcon />}
                    text={"Phone"}
                    classNames="icon__text"
                  />
                </a>
              </div>
            </div>

            <div className="col-6 md:col-4 lg:col-4 icons">
              <div className="icons__view">
                <a
                  href={`mailto:${clientEmail}?subject=${encodeURIComponent(
                    clientEmailSubject
                  )}&body=${encodeURIComponent(clientEmailbody)}`}
                  onClick={composeEmail}
                >
                  <SvgIconWithText
                    icon={<SvgEmailIcon />}
                    text={"Email"}
                    classNames="icon__text"
                  />
                </a>
              </div>
            </div>

            <div className="col-6 md:col-4 lg:col-4 icons">
              <div className="icons__view">
                <SvgIconWithText
                  icon={<SvgDeleteIcon />}
                  text={"Delete"}
                  classNames="icon__text"
                />
              </div>
            </div>
          </div>
        </div>
      </Cardcomponent>
      <div
        className="m-0 pl-4 pr-4 pt-0 pb-0 side__style"
        onClick={() => setVisible(true)}
      >
        <div className="side__view">
          <SvgArrowClientIcon />
        </div>
      </div>

      <Dialog
        visible={visible}
        style={{ width: "50vw" }}
        onHide={() => setVisible(false)}
      >
        <button onClick={handleSinglesubmit}>
          {/* <div class="text-center p-1 border-round-sm bg-primary font-bold"> */}
          Share Single pdf
          {/* </div> */}
        </button>
        <button onClick={handleOnSubmit}>
          {/* <div class="text-center p-1 border-round-sm bg-primary font-bold"> */}
          Share Multi pdf
          {/* </div> */}
        </button>
      </Dialog>
    </div>
  );
};

export default Client;
