import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { BreadCrumb } from "primereact/breadcrumb";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { RadioButton } from "primereact/radiobutton";
import { Checkbox } from "primereact/checkbox";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgDot from "../../../assets/icons/SvgDot";
import "../openEntryMatching/OpenEntryMatching.scss";
import accountingService from "../../../services/accountingService";
import { Dropdown } from "primereact/dropdown";
import useOpenItemAccounts from "../openEntryMatching/useOpenItemAccounts";
import { notifyError, notifySuccess, notifyWarn } from "../../../utility/dialogs";
import { openConfirm } from "../../../components/ConfirmDialog";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";

const OpenEntryUnmatching = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [filters, setFilters] = useState({
    subAccountCode: "",
    division: "",
    department: "",
    analysisCode1: "",
    analysisCode2: "",
    currencyCode: "",
  });
  const [debitCredit, setDebitCredit] = useState("DEBIT");
  const [selectAll, setSelectAll] = useState(false);
  const [debitEntries, setDebitEntries] = useState([]);
  const [creditEntries, setCreditEntries] = useState([]);
  const [selectedDebits, setSelectedDebits] = useState([]);
  const [selectedCredits, setSelectedCredits] = useState([]);
  const [footerData, setFooterData] = useState({
    ctrlAcntCode: "",
    divnCode: "",
    deptCode: "",
    docRef: "",
    narration: "",
    actyCode1: "",
    writeOffCode: "",
    writeOffAmount: "",
    net: "",
  });
  const [loading, setLoading] = useState(false);
  const subAccountOptions = useOpenItemAccounts();

  const items = [
    {
      id: 1,
      label: t("openEntryUnmatching.title"),
      to: "/accounts/open-entry-unmatching",
    },
  ];
  const home = { label: t("openEntryUnmatching.accounts") };

  const handlePull = async () => {
    setLoading(true);
    try {
      const response = await accountingService.getMatchedEntries({
        debitCredit: debitCredit,
        currency: filters.currencyCode || undefined,
        page: 1,
        pageSize: 100,
      });

      if (!response.success) {
        notifyError(response.error || "Failed to fetch matched entries");
      } else {
        const matches = response.data || [];
        // Transform matched entries into separate debit and credit entries
        const debitEntriesList = matches.map((match) => ({
          ...match.debitTransaction,
          matchingId: match.id,
          matchedAmount: match.matchedAmount,
          matchedDate: match.matchedDate,
        }));
        const creditEntriesList = matches.map((match) => ({
          ...match.creditTransaction,
          matchingId: match.id,
          matchedAmount: match.matchedAmount,
          matchedDate: match.matchedDate,
        }));
        setDebitEntries(debitEntriesList);
        setCreditEntries(creditEntriesList);
      }
    } catch (error) {
      notifyError("Failed to fetch matched entries");
    } finally {
      setLoading(false);
    }
  };

  const handleUnmatch = async () => {
    if (selectedDebits.length === 0 || selectedCredits.length === 0) {
      notifyWarn(t("openEntryUnmatching.pleaseSelectDebitAndCredit"));
      return;
    }

    // Get unique matching IDs from selected entries
    const matchingIds = [
      ...new Set([
        ...selectedDebits.map((entry) => entry.matchingId),
        ...selectedCredits.map((entry) => entry.matchingId),
      ]),
    ].filter((id) => id);

    if (matchingIds.length === 0) {
      notifyWarn(t("openEntryUnmatching.noValidMatchingSelected"));
      return;
    }

    const total = (rows) => rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const confirmed = await openConfirm({
      title: t("accounts.openEntryDialogs.unmatchTitle"),
      severity: "warning",
      message: t("accounts.openEntryDialogs.unmatchMessage", { count: matchingIds.length }),
      facts: [
        { label: t("accounts.openEntryDialogs.debitsSelected"), value: selectedDebits.length, type: "number" },
        { label: t("accounts.openEntryDialogs.debitTotal"), value: total(selectedDebits), type: "amount" },
        { label: t("accounts.openEntryDialogs.creditsSelected"), value: selectedCredits.length, type: "number" },
        { label: t("accounts.openEntryDialogs.creditTotal"), value: total(selectedCredits), type: "amount" },
      ],
      confirmLabel: t("accounts.openEntryDialogs.unmatchEntries", { count: matchingIds.length }),
    });
    if (!confirmed) return;

    setLoading(true);
    try {

      const response = await accountingService.unmatchEntries(matchingIds);

      if (!response.success) {
        notifyError(response.error || t("openEntryUnmatching.failedToUnmatchEntries"));
      } else {
        notifySuccess(`Successfully unmatched ${response.data.length} entry pair(s)`);
        setSelectedDebits([]);
        setSelectedCredits([]);
        handlePull();
      }
    } catch (error) {
      notifyError(error.message || t("openEntryUnmatching.failedToUnmatchEntries"));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (type) => {
    if (type === "debit") {
      if (selectAll) {
        setSelectedDebits([]);
      } else {
        setSelectedDebits([...debitEntries]);
      }
      setSelectAll(!selectAll);
    } else {
      if (selectAll) {
        setSelectedCredits([]);
      } else {
        setSelectedCredits([...creditEntries]);
      }
      setSelectAll(!selectAll);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return formatAppDate(dateString, { empty: "" });
  };

  const calculateTotal = (entries, field) => {
    return entries.reduce((sum, entry) => {
      return sum + (parseFloat(entry[field]) || 0);
    }, 0);
  };

  const debitTotal = calculateTotal(debitEntries, "amount");
  const creditTotal = calculateTotal(creditEntries, "amount");

  const debitEntriesTable = () => {
    return (
      <div className="col-12  grid__container__open__entry__matching">
        <div className="main__tabel__title__open__entry__matching">
          {t("openEntryUnmatching.debitEntries")}
        </div>
        <div className="card p-1">
          <DataTable
            value={debitEntries}
            selection={selectedDebits}
            onSelectionChange={(e) => setSelectedDebits(e.value)}
            dataKey="id"
            scrollable
            scrollHeight="300px"
            className="entry__table__open__entry__matching"
          >
            <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
            <Column
              field="transactionCode"
              header={t("openEntryUnmatching.documentNo")}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="documentDate"
              header={t("openEntryUnmatching.docDt")}
              body={(rowData) => formatDate(rowData.documentDate)}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="dueDate"
              header={t("openEntryUnmatching.dueDt")}
              body={(rowData) => formatDate(rowData.dueDate)}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="amount"
              header={t("openEntryUnmatching.fcAmount")}
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="amount"
              header={t("openEntryUnmatching.lcAmount")}
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="amount"
              header={t("openEntryUnmatching.balanceFcAmt")}
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "130px" }}
            />
            <Column
              field="amount"
              header={t("openEntryUnmatching.balanceLcAmt")}
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "130px" }}
            />
            <Column
              header={t("openEntryUnmatching.adjustmentAmt")}
              body={() => (
                <InputText className="adjustment__input__open__entry__matching" />
              )}
              style={{ minWidth: "130px" }}
            />
            <Column
              header="Cr"
              body={() => <Checkbox />}
              style={{ minWidth: "50px" }}
            />
            <Column
              header="Ok"
              body={() => <Checkbox />}
              style={{ minWidth: "50px" }}
            />
          </DataTable>
          <div className="total__row__open__entry__matching">
            <span>{t("openEntryUnmatching.total")}:</span>
            <span>{formatCurrency(debitTotal)}</span>
            <span>{formatCurrency(debitTotal)}</span>
            <span>{formatCurrency(debitTotal)}</span>
            <span>{formatCurrency(debitTotal)}</span>
          </div>
        </div>
      </div>
    );
  };

  const creditEntriesTable = () => {
    return (
      <div className="col-12  grid__container__open__entry__matching">
        <div className="main__tabel__title__open__entry__matching">
          {t("openEntryUnmatching.creditEntries")}
        </div>
        <div className="card p-1">
          <DataTable
            value={creditEntries}
            selection={selectedCredits}
            onSelectionChange={(e) => setSelectedCredits(e.value)}
            dataKey="id"
            scrollable
            scrollHeight="300px"
            className="entry__table__open__entry__matching"
          >
            <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
            <Column
              field="transactionCode"
              header={t("openEntryUnmatching.documentNo")}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="documentDate"
              header={t("openEntryUnmatching.docDt")}
              body={(rowData) => formatDate(rowData.documentDate)}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="dueDate"
              header={t("openEntryUnmatching.dueDt")}
              body={(rowData) => formatDate(rowData.dueDate)}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="amount"
              header={t("openEntryUnmatching.fcAmount")}
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="amount"
              header={t("openEntryUnmatching.lcAmount")}
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="amount"
              header={t("openEntryUnmatching.balanceFcAmt")}
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "130px" }}
            />
            <Column
              field="amount"
              header={t("openEntryUnmatching.balanceLcAmt")}
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "130px" }}
            />
            <Column
              header={t("openEntryUnmatching.adjustmentAmt")}
              body={() => (
                <InputText className="adjustment__input__open__entry__matching" />
              )}
              style={{ minWidth: "130px" }}
            />
            <Column
              header="Cr"
              body={() => <Checkbox />}
              style={{ minWidth: "50px" }}
            />
            <Column
              header="Ok"
              body={() => <Checkbox />}
              style={{ minWidth: "50px" }}
            />
          </DataTable>
          <div className="total__row__open__entry__matching">
            <span>{t("openEntryUnmatching.total")}:</span>
            <span>{formatCurrency(creditTotal)}</span>
            <span>{formatCurrency(creditTotal)}</span>
            <span>{formatCurrency(creditTotal)}</span>
            <span>{formatCurrency(creditTotal)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid container__open__entry__matching">
      <div className="col-12"></div>
      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="add__icon__title__open__entry__matching">
          Open Entry Unmatching
        </div>
        <div className="mt-4">
          <BreadCrumb
            home={home}
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
            className="breadCrums__view__open__entry__matching"
          />
        </div>
      </div>

      <div className="col-12 m-0">
        <div className="sub__container__open__entry__matching">
          <div className="col-12 filter__section__open__entry__matching">
            <div className="filter__row__open__entry__matching">
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>{t("openEntryFilters.subAccountCode")}</label>

                  <Dropdown
                    value={filters.subAccountCode}
                    onChange={(e) =>
                      setFilters({ ...filters, subAccountCode: e.value })
                    }
                    options={subAccountOptions}
                    optionLabel="label"
                    optionValue="value"
                    placeholder={t("openEntryFilters.subAccountCode")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>{t("openEntryFilters.division")}</label>
                  <InputText
                    value={filters.division}
                    onChange={(e) =>
                      setFilters({ ...filters, division: e.target.value })
                    }
                    placeholder={t("openEntryFilters.division")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>{t("openEntryFilters.department")}</label>
                  <InputText
                    value={filters.department}
                    onChange={(e) =>
                      setFilters({ ...filters, department: e.target.value })
                    }
                    placeholder={t("openEntryFilters.department")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
            </div>
            <div className="filter__row__open__entry__matching">
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>{t("openEntryFilters.analysisCode1")}</label>
                  <InputText
                    value={filters.analysisCode1}
                    onChange={(e) =>
                      setFilters({ ...filters, analysisCode1: e.target.value })
                    }
                    placeholder={t("openEntryFilters.analysisCode1")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>{t("openEntryFilters.analysisCode2")}</label>
                  <InputText
                    value={filters.analysisCode2}
                    onChange={(e) =>
                      setFilters({ ...filters, analysisCode2: e.target.value })
                    }
                    placeholder={t("openEntryFilters.analysisCode2")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>{t("openEntryFilters.currencyCode")}</label>
                  <InputText
                    value={filters.currencyCode}
                    onChange={(e) =>
                      setFilters({ ...filters, currencyCode: e.target.value })
                    }
                    placeholder={t("openEntryFilters.currencyCode")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
            </div>
            <div className="action__row__open__entry__matching">
              <Button
                label={t("openEntryUnmatching.pull")}
                onClick={handlePull}
                disabled={loading}
                outlined
                className="action__button__open__entry__matching"
              />
              <Button
                label={t("openEntryUnmatching.unmatch")}
                onClick={handleUnmatch}
                disabled={loading}
                className="action__button__open__entry__matching"
              />
              <div className="radio__group__open__entry__matching">
                <div>{t("openEntryActions.side")}</div>
                <div className="radio__item__open__entry__matching">
                  <RadioButton
                    inputId="debit"
                    value="DEBIT"
                    checked={debitCredit === "DEBIT"}
                    onChange={(e) => setDebitCredit(e.value)}
                  />
                  <label htmlFor="debit">{t("openEntryActions.debit")}</label>
                </div>
                <div className="radio__item__open__entry__matching">
                  <RadioButton
                    inputId="credit"
                    value="CREDIT"
                    checked={debitCredit === "CREDIT"}
                    onChange={(e) => setDebitCredit(e.value)}
                  />
                  <label htmlFor="credit">{t("openEntryActions.credit")}</label>
                </div>
              </div>
              <div className="checkbox__group__open__entry__matching">
                <Checkbox
                  inputId="selectAll"
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(debitCredit.toLowerCase())}
                />
                <label htmlFor="selectAll">{t("openEntryActions.selectAll")}</label>
              </div>
            </div>
          </div>

          <div className="col-12 grids__section__open__entry__matching">
            {debitCredit === "DEBIT" ? (
              <>
                {debitEntriesTable()}
                {creditEntriesTable()}
              </>
            ) : (
              <>
                {creditEntriesTable()}
                {debitEntriesTable()}
              </>
            )}
          </div>

          <div className="col-12 footer__section__open__entry__matching">
            <div className="footer__row__open__entry__matching">
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>{t("openEntryFilters.controlAccountCode")}</label>
                  <InputText
                    value={footerData.ctrlAcntCode}
                    onChange={(e) =>
                      setFooterData({
                        ...footerData,
                        ctrlAcntCode: e.target.value,
                      })
                    }
                    placeholder={t("openEntryFilters.controlAccountCode")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>{t("openEntryFilters.divisionCode")}</label>
                  <InputText
                    value={footerData.divnCode}
                    onChange={(e) =>
                      setFooterData({ ...footerData, divnCode: e.target.value })
                    }
                    placeholder={t("openEntryFilters.divisionCode")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>{t("openEntryFilters.departmentCode")}</label>
                  <InputText
                    value={footerData.deptCode}
                    onChange={(e) =>
                      setFooterData({ ...footerData, deptCode: e.target.value })
                    }
                    placeholder={t("openEntryFilters.departmentCode")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
            </div>
            <div className="footer__row__open__entry__matching">
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>{t("openEntryFilters.documentReference")}</label>
                  <InputText
                    value={footerData.docRef}
                    onChange={(e) =>
                      setFooterData({ ...footerData, docRef: e.target.value })
                    }
                    placeholder={t("openEntryFilters.documentReference")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>{t("openEntryFilters.narration")}</label>
                  <InputText
                    value={footerData.narration}
                    onChange={(e) =>
                      setFooterData({
                        ...footerData,
                        narration: e.target.value,
                      })
                    }
                    placeholder={t("openEntryFilters.narration")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>{t("openEntryFilters.activityCode1")}</label>
                  <InputText
                    value={footerData.actyCode1}
                    onChange={(e) =>
                      setFooterData({
                        ...footerData,
                        actyCode1: e.target.value,
                      })
                    }
                    placeholder={t("openEntryFilters.activityCode1")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
            </div>
            <div className="footer__row__open__entry__matching">
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>{t("openEntryFilters.writeOffCode")}</label>
                  <InputText
                    value={footerData.writeOffCode}
                    onChange={(e) =>
                      setFooterData({
                        ...footerData,
                        writeOffCode: e.target.value,
                      })
                    }
                    placeholder={t("openEntryFilters.writeOffCode")}
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>{t("openEntryFilters.writeOffAmount")}</label>
                  <InputText
                    value={footerData.writeOffAmount}
                    onChange={(e) =>
                      setFooterData({
                        ...footerData,
                        writeOffAmount: e.target.value,
                      })
                    }
                    placeholder="0.00"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>{t("openEntryFilters.net")}</label>
                  <InputText
                    value={footerData.net}
                    onChange={(e) =>
                      setFooterData({ ...footerData, net: e.target.value })
                    }
                    placeholder="0.00"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenEntryUnmatching;
