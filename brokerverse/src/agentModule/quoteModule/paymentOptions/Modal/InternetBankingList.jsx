import { Dialog } from "primereact/dialog";
import { useTranslation } from "react-i18next";
import "./index.scss";

const InternetBankingList = ({ modalVisible, setModalVisible }) => {
  const { t } = useTranslation();
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

  return (
    <Dialog
      visible={modalVisible}
      header={t("agent.internetBanking")}
      style={{ width: "40rem" }}
      breakpoints={{ "768px": "95vw" }}
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
