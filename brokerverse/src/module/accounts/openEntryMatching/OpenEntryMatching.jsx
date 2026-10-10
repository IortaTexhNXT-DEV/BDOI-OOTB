import { useEffect, useState } from "react";
import { BreadCrumb } from "primereact/breadcrumb";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { RadioButton } from "primereact/radiobutton";
import { Checkbox } from "primereact/checkbox";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgDot from "../../../assets/icons/SvgDot";
import "./OpenEntryMatching.scss";
import accountingService from "../../../services/accountingService";
import postingRulesService from "../../../services/postingRulesService";
import useOpenItemAccounts from "./useOpenItemAccounts";
import { notifyError, notifySuccess, notifyWarn } from "../../../utility/dialogs";
import { openConfirm } from "../../../components/ConfirmDialog";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";

const OpenEntryMatching = () => {
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
  // write-off reasons (Account Determination): the adjustment is posted to the reason's GL account
  const [writeOffReasons, setWriteOffReasons] = useState([]);
  useEffect(() => {
    postingRulesService.writeOffReasons().then((rows) => setWriteOffReasons(rows || [])).catch(() => setWriteOffReasons([]));
  }, []);
  const [loading, setLoading] = useState(false);
  const subAccountOptions = useOpenItemAccounts();

  const items = [
    {
      id: 1,
      label: "Open Entry Matching",
      to: "/accounts/open-entry-matching",
    },
  ];
  const home = { label: "Accounts" };

  const handlePull = async () => {
    setLoading(true);
    try {
      const response = await accountingService.getUnmatchedEntries({
        accountCode: filters.subAccountCode,
        currency: filters.currencyCode,
      });
      if (!response.success) {
        notifyError(response.error || "Failed to fetch unmatched entries");
      } else {
        const entries = response.data || [];
        const debitEntries = entries.filter(
          (entry) => entry.debitCredit === "DEBIT"
        );
        const creditEntries = entries.filter(
          (entry) => entry.debitCredit === "CREDIT"
        );
        setDebitEntries(debitEntries);
        setCreditEntries(creditEntries);
      }
    } catch (error) {
      notifyError("Failed to fetch unmatched entries");
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async () => {
    if (selectedDebits.length === 0 || selectedCredits.length === 0) {
      notifyWarn(t("validation.selectOneDebitOneCredit"));
      return;
    }

    const total = (rows) => rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const pairs = Math.min(selectedDebits.length, selectedCredits.length);
    const debitTotal = total(selectedDebits);
    const creditTotal = total(selectedCredits);
    const confirmed = await openConfirm({
      title: t("accounts.openEntryDialogs.matchTitle"),
      message: t("accounts.openEntryDialogs.matchMessage", { count: pairs }),
      facts: [
        { label: t("accounts.openEntryDialogs.debitsSelected"), value: selectedDebits.length, type: "number" },
        { label: t("accounts.openEntryDialogs.debitTotal"), value: debitTotal, type: "amount" },
        { label: t("accounts.openEntryDialogs.creditsSelected"), value: selectedCredits.length, type: "number" },
        { label: t("accounts.openEntryDialogs.creditTotal"), value: creditTotal, type: "amount" },
        { label: t("accounts.openEntryDialogs.difference"), value: Math.round((debitTotal - creditTotal) * 100) / 100, type: "amount", emphasis: true },
        { label: t("accounts.openEntryDialogs.writeOffAmount"), value: footerData.writeOffAmount, type: "amount", hidden: !footerData.writeOffAmount },
      ],
      confirmLabel: t("accounts.openEntryDialogs.matchEntries", { count: pairs }),
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const matchPairs = [];
      const minLength = Math.min(selectedDebits.length, selectedCredits.length);

      for (let i = 0; i < minLength; i++) {
        matchPairs.push({
          debitTransactionId: selectedDebits[i].id,
          creditTransactionId: selectedCredits[i].id,
          matchedAmount: Math.min(
            parseFloat(selectedDebits[i].amount) || 0,
            parseFloat(selectedCredits[i].amount) || 0
          ),
          adjustmentAmount: footerData.writeOffAmount
            ? parseFloat(footerData.writeOffAmount)
            : null,
        });
      }

      const response = await accountingService.matchEntries(matchPairs, {
        documentRef: footerData.docRef,
        narration: footerData.narration,
        writeOffCode: footerData.writeOffCode,
        writeOffAmount: footerData.writeOffAmount,
      });

      if (!response.success) {
        notifyError(response.error || "Failed to match entries");
      } else {
        notifySuccess(`Successfully matched ${response.data.length} entry pair(s)`);
        setSelectedDebits([]);
        setSelectedCredits([]);
        handlePull();
      }
    } catch (error) {
      notifyError(error.message || "Failed to match entries");
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
          Debit Entries
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
              header="Document No"
              style={{ minWidth: "120px" }}
            />
            <Column
              field="documentDate"
              header="Doc Dt"
              body={(rowData) => formatDate(rowData.documentDate)}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="dueDate"
              header="Due Dt"
              body={(rowData) => formatDate(rowData.dueDate)}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="amount"
              header="FC Amount"
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="amount"
              header="LC Amount"
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="amount"
              header="Balance FC Amt"
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "130px" }}
            />
            <Column
              field="amount"
              header="Balance LC Amt"
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "130px" }}
            />
            <Column
              header="Adjustment Amt"
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
            <span>Total:</span>
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
          Credit Entries
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
              header="Document No"
              style={{ minWidth: "120px" }}
            />
            <Column
              field="documentDate"
              header="Doc Dt"
              body={(rowData) => formatDate(rowData.documentDate)}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="dueDate"
              header="Due Dt"
              body={(rowData) => formatDate(rowData.dueDate)}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="amount"
              header="FC Amount"
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="amount"
              header="LC Amount"
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="amount"
              header="Balance FC Amt"
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "130px" }}
            />
            <Column
              field="amount"
              header="Balance LC Amt"
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ minWidth: "130px" }}
            />
            <Column
              header="Adjustment Amt"
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
            <span>Total:</span>
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
          Open Entry Matching
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
                  <label>Sub Account Code</label>
                  <Dropdown
                    value={filters.subAccountCode}
                    onChange={(e) =>
                      setFilters({ ...filters, subAccountCode: e.value })
                    }
                    options={subAccountOptions}
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Sub Account Code"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>Division</label>
                  <InputText
                    value={filters.division}
                    onChange={(e) =>
                      setFilters({ ...filters, division: e.target.value })
                    }
                    placeholder="Division"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>Department</label>
                  <InputText
                    value={filters.department}
                    onChange={(e) =>
                      setFilters({ ...filters, department: e.target.value })
                    }
                    placeholder="Department"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
            </div>
            <div className="filter__row__open__entry__matching">
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>Anly Code 1</label>
                  <InputText
                    value={filters.analysisCode1}
                    onChange={(e) =>
                      setFilters({ ...filters, analysisCode1: e.target.value })
                    }
                    placeholder="Analysis Code 1"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>Anly Code 2</label>
                  <InputText
                    value={filters.analysisCode2}
                    onChange={(e) =>
                      setFilters({ ...filters, analysisCode2: e.target.value })
                    }
                    placeholder="Analysis Code 2"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="filter__group__open__entry__matching">
                  <label>Currency Code</label>
                  <InputText
                    value={filters.currencyCode}
                    onChange={(e) =>
                      setFilters({ ...filters, currencyCode: e.target.value })
                    }
                    placeholder="Currency Code"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
            </div>
            <div className="action__row__open__entry__matching">
              <Button
                label="Pull"
                onClick={handlePull}
                disabled={loading}
                outlined
                className="action__button__open__entry__matching"
              />
              <Button
                label="Match"
                onClick={handleMatch}
                disabled={loading}
                className="action__button__open__entry__matching"
              />
              <div className="radio__group__open__entry__matching">
                <div>Pull By Criteria</div>
                <div className="radio__item__open__entry__matching">
                  <RadioButton
                    inputId="debit"
                    value="DEBIT"
                    checked={debitCredit === "DEBIT"}
                    onChange={(e) => setDebitCredit(e.value)}
                  />
                  <label htmlFor="debit">Debit</label>
                </div>
                <div className="radio__item__open__entry__matching">
                  <RadioButton
                    inputId="credit"
                    value="CREDIT"
                    checked={debitCredit === "CREDIT"}
                    onChange={(e) => setDebitCredit(e.value)}
                  />
                  <label htmlFor="credit">Credit</label>
                </div>
              </div>
              <div className="checkbox__group__open__entry__matching">
                <Checkbox
                  inputId="selectAll"
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(debitCredit.toLowerCase())}
                />
                <label htmlFor="selectAll">Select All ?</label>
              </div>
              <Button
                label="Cash Discount"
                className="action__button__open__entry__matching"
              />
            </div>
          </div>

          <div className="col-12 grids__section__open__entry__matching">
            {debitCredit === "DEBIT" ? (
              <>
                {debitEntriesTable(debitEntries)}
                {creditEntriesTable(creditEntries)}
                <Column
                  selectionMode="multiple"
                  headerStyle={{ width: "3rem" }}
                />
                <Column
                  field="transactionCode"
                  header="Document No"
                  style={{ minWidth: "120px" }}
                />
                <Column
                  field="documentDate"
                  header="Doc Dt"
                  body={(rowData) => formatDate(rowData.documentDate)}
                  style={{ minWidth: "100px" }}
                />
                <Column
                  field="dueDate"
                  header="Due Dt"
                  body={(rowData) => formatDate(rowData.dueDate)}
                  style={{ minWidth: "100px" }}
                />
                <Column
                  field="amount"
                  header="FC Amount"
                  body={(rowData) => formatCurrency(rowData.amount)}
                  style={{ minWidth: "120px" }}
                />
                <Column
                  field="amount"
                  header="LC Amount"
                  body={(rowData) => formatCurrency(rowData.amount)}
                  style={{ minWidth: "120px" }}
                />
                <Column
                  field="amount"
                  header="Balance FC Amt"
                  body={(rowData) => formatCurrency(rowData.amount)}
                  style={{ minWidth: "130px" }}
                />
                <Column
                  field="amount"
                  header="Balance LC Amt"
                  body={(rowData) => formatCurrency(rowData.amount)}
                  style={{ minWidth: "130px" }}
                />
                <Column
                  header="Adjustment Amt"
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
              </>
            ) : (
              <>
                {creditEntriesTable(creditEntries)}
                {debitEntriesTable(debitEntries)}
              </>
            )}
          </div>

          <div className="col-12 footer__section__open__entry__matching">
            <div className="footer__row__open__entry__matching">
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>Ctrl Acnt Code</label>
                  <InputText
                    value={footerData.ctrlAcntCode}
                    onChange={(e) =>
                      setFooterData({
                        ...footerData,
                        ctrlAcntCode: e.target.value,
                      })
                    }
                    placeholder="Control Account Code"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>Divn Code</label>
                  <InputText
                    value={footerData.divnCode}
                    onChange={(e) =>
                      setFooterData({ ...footerData, divnCode: e.target.value })
                    }
                    placeholder="Division Code"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>Dept Code</label>
                  <InputText
                    value={footerData.deptCode}
                    onChange={(e) =>
                      setFooterData({ ...footerData, deptCode: e.target.value })
                    }
                    placeholder="Department Code"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
            </div>
            <div className="footer__row__open__entry__matching">
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>Doc Ref</label>
                  <InputText
                    value={footerData.docRef}
                    onChange={(e) =>
                      setFooterData({ ...footerData, docRef: e.target.value })
                    }
                    placeholder="Document Reference"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>Narration</label>
                  <InputText
                    value={footerData.narration}
                    onChange={(e) =>
                      setFooterData({
                        ...footerData,
                        narration: e.target.value,
                      })
                    }
                    placeholder="Narration"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>Acty Code 1</label>
                  <InputText
                    value={footerData.actyCode1}
                    onChange={(e) =>
                      setFooterData({
                        ...footerData,
                        actyCode1: e.target.value,
                      })
                    }
                    placeholder="Activity Code 1"
                    className="input__field__open__entry__matching"
                  />
                </div>
              </div>
            </div>
            <div className="footer__row__open__entry__matching">
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>Write off Code</label>
                  <Dropdown
                    value={footerData.writeOffCode}
                    options={writeOffReasons.map((r) => ({ label: `${r.code} – ${r.name} (${r.glAccount})`, value: r.code }))}
                    onChange={(e) =>
                      setFooterData({
                        ...footerData,
                        writeOffCode: e.value || "",
                      })
                    }
                    showClear
                    placeholder="Write off reason"
                    className="input__field__open__entry__matching w-full"
                  />
                </div>
              </div>
              <div className="col-12 md:col-4 lg:col-4">
                <div className="footer__group__open__entry__matching">
                  <label>Write off Amount</label>
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
                  <label>Net</label>
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

export default OpenEntryMatching;
