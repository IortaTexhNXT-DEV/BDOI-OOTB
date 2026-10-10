import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import DetailDialog from "../../../../components/DetailDialog";
import DetailHeader from "../../../../components/DetailHeader";
import KeyValueGrid from "../../../../components/KeyValueGrid";

/** Read-only view of the account category opened from the list (AccountCategoryDetailView of the store). */
const ModalViewData = ({ visible, setVisible }) => {
  const { t } = useTranslation();
  const { AccountCategoryDetailView: category } = useSelector(({ accountCategoryReducer }) => ({
    AccountCategoryDetailView: accountCategoryReducer?.AccountCategoryDetailView,
  }));

  if (!visible) return null;
  const status = category?.status ? String(category.status) : null;
  return (
    <DetailDialog visible onHide={() => setVisible(false)} header={t("financeMasters.accountCategoryDetail")} size="md">
      <DetailHeader
        title={category?.categoryName || category?.categoryCode || "—"}
        subtitle={category?.categoryCode}
        status={status ? { code: status.toLowerCase(), label: status } : null}
      />
      <KeyValueGrid columns={2} items={[
        { label: t("financeMasters.accountCategoryCodeHeader"), value: category?.categoryCode },
        { label: t("financeMasters.accountCategoryNameHeader"), value: category?.categoryName },
        { label: t("financeMasters.description"), value: category?.description, span: "full" },
      ]} />
    </DetailDialog>
  );
};

export default ModalViewData;
