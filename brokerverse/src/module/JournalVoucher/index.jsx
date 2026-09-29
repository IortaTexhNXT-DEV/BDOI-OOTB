import { BreadCrumb } from "primereact/breadcrumb";
import React, { useState, useRef, useEffect } from "react";
import NavBar from "../../components/NavBar";
import SvgDot from "../../assets/icons/SvgDot";
import "../JournalVoucher/index.scss";
import SvgAdd from "../../assets/icons/SvgAdd";
import { useNavigate } from "react-router-dom";
import SvgFilters from "../../assets/icons/SvgFilters";
import { InputText } from "primereact/inputtext";
import SvgSearchIcon from "../../assets/icons/SvgSearchIcon";
import { Dropdown } from "primereact/dropdown";
import { TieredMenu } from "primereact/tieredmenu";
import SvgTable from "../../assets/icons/SvgTable";
import { useDispatch, useSelector } from "react-redux";
import DataTabelJV from "./DataTabelJV";
import {
  getJournalVoucherSearchList,
  journalVoucherMiddleware,
  getJournalVoucherHistory,
} from "./store/journalVoucherMiddleware";
import { useFormik } from "formik";
import SvgDropdown from "../../assets/icons/SvgDropdown";
import SvgDropdownicon from "../../assets/icons/SvgDropdownicon";
import { useTranslation } from "react-i18next";

const JournalVoucher = () => {
  const { t } = useTranslation();
  const { journalVoucherList, journalVoucherSearchList, loading, pagination } =
    useSelector(({ journalVoucherMainReducers }) => {
      return {
        loading: journalVoucherMainReducers?.loading,
        journalVoucherList: journalVoucherMainReducers?.journalVoucherList,
        journalVoucherSearchList:
          journalVoucherMainReducers?.journalVoucherSearchList,
        pagination: journalVoucherMainReducers?.pagination || {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        },
      };
    });

  const [selectedCity, setSelectedCity] = useState(null);
  const cities = [
    { name: t("accounts.transactionCode"), code: "transactionCode" },
    { name: t("accounts.transactionNumber"), code: "transactionNumber" },
  ];

  const [products, setProducts] = useState([]);
  const [visible, setVisible] = useState(false);
  const [newDataTable, setnewDataTable] = useState([]);
  const navigate = useNavigate();
  const [globalFilter, setGlobalFilter] = useState("");
  const [search, setSearch] = useState("");
  const items = [
    { id: 1, label: t("accounts.journalVoucher"), to: "/accounts/journalvoucher" },
  ];
  const home = { label: t("sidebar.Accounts") };
  const handleNavigate = () => {
    navigate("/accounts/journalvoucher/addjournalvoucture");
  };

  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const isInitialMount = useRef(true);

  const handleEdit = () => {
    setVisible(true);
  };
  const dispatch = useDispatch();
  const handleSubmit = (values) => {
    dispatch(getJournalVoucherSearchList({ textSearch: values.search }));
  };

  // Load data on component mount
  useEffect(() => {
    if (isInitialMount.current) {
      dispatch(
        getJournalVoucherHistory({
          page: 1,
          pageSize: rowsPerPage,
        })
      );
      isInitialMount.current = false;
    }
  }, [dispatch, rowsPerPage]);

  // Handle pagination changes
  useEffect(() => {
    if (!isInitialMount.current) {
      const params = {
        page: currentPage,
        pageSize: rowsPerPage,
      };

      // Add filters if search is active
      if (globalFilter && search) {
        params[globalFilter] = search;
      }

      dispatch(getJournalVoucherHistory(params));
    }
  }, [dispatch, currentPage, rowsPerPage]);

  // Handle search/filter changes - reset to page 1
  useEffect(() => {
    if (!isInitialMount.current) {
      setCurrentPage(1);
      setFirst(0);
      const params = {
        page: 1,
        pageSize: rowsPerPage,
      };

      if (globalFilter && search) {
        params[globalFilter] = search;
      }

      dispatch(getJournalVoucherHistory(params));
    }
  }, [search, globalFilter, dispatch, rowsPerPage]);

  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });

  const onPageChange = (event) => {
    const newPage = event.page + 1; // PrimeReact uses 0-based indexing
    const newPageSize = event.rows;
    setFirst(event.first);
    setRowsPerPage(newPageSize);
    setCurrentPage(newPage);

    // Build params for API call
    const params = {
      page: newPage,
      pageSize: newPageSize,
    };

    // Include filters if search is active
    if (globalFilter && search) {
      params[globalFilter] = search;
    }

    dispatch(getJournalVoucherHistory(params));
  };

  const menu = useRef(null);
  const menuitems = [
    { label: t("common.name") },
    { label: t("common.date") },
    { label: t("accounts.voucherNumber") },
  ];

  return (
    <div className="grid  container__Journal__Voture">
      <div className="col-12"></div>
      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="add__icon__title__Journal__Voture">{t("accounts.journalVoucher")}</div>
        <div className="mt-4">
          <BreadCrumb
            home={home}
            className={items.map((val) => {
              return val.label === "/subaccount"
                ? "breadCrums__view__reversal__Journal__Voture"
                : "item__color__Journal__Voture";
            })}
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="menu-container">
      </div>
      <div className="col-12 md:col-6 lg:col-6 add__icon__alighn__Journal__Voture mb-3">
        <div
          className="add__icon__view__Journal__Voture"
          role="button"
          tabIndex={0}
          aria-label={t("accounts.voucher")}
          onClick={handleNavigate}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleNavigate()}
        >
          <div className="add__icon__Journal__Voture">
            <SvgAdd color={"#fff"} />
          </div>
          <div className="add__text__Journal__Voture">{t("accounts.voucher")}</div>
        </div>
      </div>
      <div className="col-12 m-0 ">
        <div className="sub__container__Journal__Voture">
          <div className="col-12 search__filter__view__Journal__Voture">
            {/* <form
              onSubmit={formik.handleSubmit}
              className="col-12 md:col-10 lg:col-10"
            >
              <div className="searchIcon__view__input__Journal__Voture">
                <span className="p-input-icon-left" style={{ width: "100%" }}>
                  <i className="pi pi-search" />
                  {/* <span className='p-1'> <SvgSearchIcon /></span> */}
            {/* <InputText
                placeholder="Search customers"
                className="searchinput_left"
              />
                </span>
              </div>

            // </form> */}
            <div
              class="col-12 md:col-6 lg:col-10"
              style={{ paddingLeft: 10, paddingRight: 10 }}
            >
              {/* <div class="text-center p-3 border-round-sm bg-primary font-bold"> */}
              <span className="p-input-icon-left" style={{ width: "100%" }}>
                <i className="pi pi-search" />
                <InputText
                  placeholder="Search Transactions"
                  className="searchinput_left"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </span>
            </div>

            <div className="col-12 md:col-2 lg:col-2">
              <Dropdown
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.value)}
                options={cities}
                optionValue="code"
                optionLabel="name"
                placeholder={t("accounts.searchBy")}
                className="sorbyfilter_container"
                dropdownIcon={<SvgDropdownicon />}
              />
            </div>
          </div>
          <div className="col-12 ">
            <div
              className="main__tabel__title__Journal__Voture "
              style={{ paddingLeft: 10, paddingRight: 10 }}
            >
              Journal Voucher history
            </div>
          </div>
          <div
            className="col-12 md:col-12 lg-col-12"
            style={{
              maxWidth: "100%",
              maxHeight: "40vh",
              paddingLeft: 16,
              paddingRight: 16,
            }}
          >
            <div className="card p-1">
              <DataTabelJV
                handleEdit={handleEdit}
                newDataTable={newDataTable}
                visible={visible}
                journalVoucherList={journalVoucherList}
                pagination={pagination}
                loading={loading}
                onPageChange={onPageChange}
                first={first}
                rowsPerPage={rowsPerPage}
                t={t}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalVoucher;
