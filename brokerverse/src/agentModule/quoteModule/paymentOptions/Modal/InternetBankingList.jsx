import React from "react";
import { Dialog } from "primereact/dialog";
import "./index.scss";

const InternetBankingList = ({ modalVisible, setModalVisible }) => {
  const bankNames = [
    "ABC Bank",
    "Metropolitan Bank",
    "Land Bank",
    "National Bank",
    "Security Bank",
    "ABC Bank",
    "Metropolitan Bank",
    "Land Bank",
    "National Bank",
    "Security Bank",
  ];

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(
        "https://www.figma.com/file/STJkBwHGeOlCFmrkBBL"
      );
    } catch (err) {
      console.error(err);
    }
  };
  return (
    <Dialog
      visible={modalVisible}
      header="Internet Banking"
      style={{ width: "40vw" }}
      className="banking__list__dialog__container"
      onHide={() => setModalVisible(false)}
      dismissableMask={true}
    >
      <div className="grid m-0 parent__div__container">
        {bankNames?.map((item, index) => (
          <div key={index} className="col-12 data__container">
            {item}
          </div>
        ))}
      </div>
    </Dialog>
  );
};

export default InternetBankingList;
