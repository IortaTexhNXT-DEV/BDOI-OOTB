import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import DetailDialog from "../../../../components/DetailDialog";
import DetailHeader from "../../../../components/DetailHeader";
import KeyValueGrid from "../../../../components/KeyValueGrid";
import DetailSection from "../../../../components/DetailSection";
import { RecordActivityLog } from "../../../../components/ActivityLog";

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
      <KeyValueGrid columns={3} items={[
        { label: t("financeMasters.description"), value: category?.description, span: "full" },
        { label: t("detailView.createdBy"), value: category?.createdBy },
        { label: t("detailView.createdOn"), value: category?.createdAt, type: "datetime" },
        { label: t("detailView.updatedOn"), value: category?.updatedAt, type: "datetime", hidden: !category?.updatedAt || category.updatedAt === category.createdAt },
      ]} />
      {category?.id ? (
        <DetailSection title={t("detailView.activity")}>
          <RecordActivityLog entity="master:account-category" recordId={category.id} />
        </DetailSection>
      ) : null}
    </DetailDialog>
  );
};

export default ModalViewData;
