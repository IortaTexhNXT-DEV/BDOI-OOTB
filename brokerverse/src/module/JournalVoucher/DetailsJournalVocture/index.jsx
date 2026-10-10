import { BreadCrumb } from "primereact/breadcrumb";
import { useCallback, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import SvgDot from "../../../assets/icons/SvgDot";
import "../DetailsJournalVocture/index.scss";
import ArrowLeftIcon from "../../../assets/icons/ArrowLeftIcon";
import { useNavigate, useParams } from "react-router-dom";
import { Toast } from "primereact/toast";
import { Button } from "primereact/button";
import ViewDataTabel from "./ViewDataTabel";
import { useDispatch, useSelector } from "react-redux";
import { getJournalVoucherDetails } from "../store/journalVoucherMiddleware";
import journalVoucherService, {
  apiErrorMessage,
} from "../../../services/journalVoucherService";
import { openConfirm } from "../../../components/ConfirmDialog";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import ApprovalActions from "../../../components/ApprovalActions";
import { RecordActivityLog } from "../../../components/ActivityLog";
import { printPdf } from "../../../components/Print";

const AWAITING_APPROVAL = "for-approval";

const DetailsJournalVocture = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { id } = useParams();
  const dispatch = useDispatch();

  const {
    loading,
    journalVoucherPostTabelData,
    journalVoucherDetailsPagination,
  } = useSelector(({ journalVoucherMainReducers }) => {
    return {
      loading: journalVoucherMainReducers?.loading,
      journalVoucherPostTabelData:
        journalVoucherMainReducers?.journalVoucherPostTabelData,
      journalVoucherDetailsPagination:
        journalVoucherMainReducers?.journalVoucherDetailsPagination || {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
    };
  });

  const items = [
    {
      label: t("accounts.journalVoucherDetails.journalVoucher"),
      command: () => navigate("/accounts/journalvoucher"),
    },
    {
      id: 1,
      label: t("accounts.journalVoucherDetails.title"),
      to: "/accounts/journalvoucher/detailsjournalvocture",
    },
  ];
  const home = { label: t("accounts.journalVoucherDetails.account") };

  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const isInitialMount = useRef(true);

  // Load journal voucher details on component mount
  useEffect(() => {
    if (id) {
      dispatch(
        getJournalVoucherDetails({
          page: 1,
          pageSize: rowsPerPage,
          transactionNumber: id,
        })
      );
      isInitialMount.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dispatch]);

  // Handle pagination changes
  useEffect(() => {
    if (!isInitialMount.current && id) {
      dispatch(
        getJournalVoucherDetails({
          page: currentPage,
          pageSize: rowsPerPage,
          transactionNumber: id,
        })
      );
    }
  }, [currentPage, rowsPerPage, id, dispatch]);

  const onPageChange = (event) => {
    const newPage = event.page + 1; // PrimeReact uses 0-based indexing
    const newPageSize = event.rows;
    setFirst(event.first);
    setRowsPerPage(newPageSize);
    setCurrentPage(newPage);
  };

  const toast = useRef(null);
  const [voucher, setVoucher] = useState(null);
  const [activityKey, setActivityKey] = useState(0);

  const showError = (error) =>
    toast.current?.show({
      severity: "error",
      summary: t("common.error"),
      detail: apiErrorMessage(error),
      life: 4000,
    });

  const loadVoucher = useCallback(async () => {
    try {
      setVoucher(await journalVoucherService.getVoucher(id));
    } catch (error) {
      showError(error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (id) loadVoucher();
  }, [id, loadVoucher]);

  const number = voucher?.transactionNumber || id;
  const statusLabel = (code) =>
    t(`accounts.journalVoucherDetails.statuses.${code}`, { defaultValue: code });

  const voucherFacts = () => [
    { label: t("accounts.journalVoucherDetails.transactionNumber"), value: number },
    { label: t("accounts.journalVoucherDetails.date"), value: voucher?.date, type: "date" },
    { label: t("accounts.journalVoucherDetails.transactionDescription"), value: voucher?.description },
    { label: t("accounts.journalVoucherDetails.totalDebit"), value: voucher?.totalDebit, type: "amount" },
    { label: t("accounts.journalVoucherDetails.totalCredit"), value: voucher?.totalCredit, type: "amount" },
  ];

  // approve posts the voucher to the ledger; reject returns it with the reason
  const decide = async (action) => {
    const reject = action === "reject";
    let result;
    const answer = await openConfirm({
      title: t(`accounts.journalVoucherDetails.confirm.${action}Title`, { number }),
      severity: reject ? "danger" : "neutral",
      message: t(`accounts.journalVoucherDetails.confirm.${action}Message`),
      facts: voucherFacts(),
      input: reject
        ? { type: "textarea", label: t("accounts.journalVoucherDetails.rejectReason"), required: true, minLength: 3, maxLength: 500 }
        : undefined,
      confirmLabel: t(`accounts.journalVoucherDetails.confirm.${action}`),
      onConfirm: async (reason) => {
        result = reject
          ? await journalVoucherService.reject(voucher?.id || id, reason)
          : await journalVoucherService.approve(voucher?.id || id);
      },
    });
    if (answer === null || answer === false) return;
    toast.current?.show({
      severity: "success",
      summary: t("accounts.journalVoucherDetails.success"),
      detail: result?.message,
      life: 3000,
    });
    setActivityKey((k) => k + 1);
    await loadVoucher();
  };

  const print = () =>
    printPdf(`/journal-vouchers/${encodeURIComponent(voucher?.id || id)}/pdf`, { fileName: `${number}.pdf` })
      .catch((error) => showError(error));

  const handleGoback = () => {
    navigate("/accounts/journalvoucher");
  };

  const kind = voucher?.kind;

  return (
    <div className="grid sub__add__container">
      <div className="col-12"></div>
      <Toast ref={toast} />

      <div className="col-12 mb-2">
        <div className="add__sub__title">
          <span className="mr-2" onClick={handleGoback}>
            <ArrowLeftIcon />
          </span>{" "}
          {t("accounts.journalVoucherDetails.title")}
        </div>
        <div className="mt-4">
          <BreadCrumb
            home={home}
            className="breadCrums__view__add__screen"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="col-12">
        <DetailHeader
          title={number}
          subtitle={voucher?.description}
          status={voucher?.status ? { code: voucher.status, label: statusLabel(voucher.status) } : null}
          meta={[
            { label: t("accounts.journalVoucherDetails.date"), value: voucher?.date, type: "date" },
            { label: t("accounts.journalVoucherDetails.totalDebit"), value: voucher?.totalDebit, type: "amount" },
            { label: t("accounts.journalVoucherDetails.totalCredit"), value: voucher?.totalCredit, type: "amount" },
          ]}
          actions={(
            <>
              <Button label={t("accounts.journalVoucherDetails.print")} icon="pi pi-print" outlined onClick={print} data-testid="print-jv" />
              {voucher?.status === AWAITING_APPROVAL && (
                <ApprovalActions
                  initiator={{ id: voucher.createdBy }}
                  approveLabel={t("accounts.journalVoucherDetails.confirm.approve")}
                  rejectLabel={t("accounts.journalVoucherDetails.confirm.reject")}
                  onApprove={() => decide("approve")}
                  onReject={() => decide("reject")}
                />
              )}
            </>
          )}
        />
      </div>
      {voucher?.status === "rejected" && voucher.rejectionReason && (
        <div className="col-12">
          <p className="m-0 bv-jv-rejection">
            {t("accounts.journalVoucherDetails.confirm.rejectedBecause", { reason: voucher.rejectionReason })}
          </p>
        </div>
      )}
      <div className="col-12">
        <DetailSection title={t("accounts.journalVoucherDetails.confirm.details")}>
          <KeyValueGrid
            columns={3}
            items={[
              { label: t("accounts.journalVoucherDetails.transactionCode"), value: voucher?.transactionCode },
              { label: t("accounts.journalVoucherDetails.confirm.kind"), value: kind ? t(`accounts.journalVoucherDetails.kinds.${kind}`, { defaultValue: kind }) : null },
              { label: t("accounts.journalVoucherDetails.confirm.source"), value: voucher?.source ? t(`accounts.journalVoucherDetails.sources.${voucher.source}`, { defaultValue: voucher.source }) : null },
              { label: t("accounts.journalVoucherDetails.confirm.createdAt"), value: voucher?.createdAt, type: "datetime" },
              { label: t("accounts.journalVoucherDetails.confirm.postedAt"), value: voucher?.postedAt, type: "datetime" },
              { label: t("accounts.journalVoucherDetails.confirm.reversalOf"), value: voucher?.reversalOf, hidden: !voucher?.reversalOf },
              { label: t("accounts.journalVoucherDetails.confirm.correctionOf"), value: voucher?.correctionOf, hidden: !voucher?.correctionOf },
              { label: t("accounts.journalVoucherDetails.confirm.reversedBy"), value: voucher?.reversedBy, hidden: !voucher?.reversedBy },
              { label: t("accounts.journalVoucherDetails.net"), value: Number(voucher?.totalCredit || 0) - Number(voucher?.totalDebit || 0), type: "amount" },
            ]}
          />
        </DetailSection>
      </div>
      <div className="col-12">
        <DetailSection title={t("accounts.journalVoucherDetails.confirm.lines")} flush>
          <ViewDataTabel
            journalVoucherPostTabelData={journalVoucherPostTabelData}
            pagination={journalVoucherDetailsPagination}
            loading={loading}
            onPageChange={onPageChange}
            first={first}
            rowsPerPage={rowsPerPage}
          />
        </DetailSection>
      </div>
      <div className="col-12">
        <DetailSection title={t("accounts.journalVoucherDetails.confirm.activity")}>
          <RecordActivityLog key={activityKey} entity="journal_voucher" recordId={voucher?.id || id} />
        </DetailSection>
      </div>
    </div>
  );
};
export default DetailsJournalVocture;
