import { createSlice } from "@reduxjs/toolkit";
import {
  getpaymentVocherByIdMiddleware,
  paymentVocherMiddleware,
  postpaymentVocherCreateDataMiddleware,
  chequebookdetailsMiddleware,
  patchpaymentStatusByIdMiddleware,
  patchpaymentVocherInvoiceListMiddleware,
  getPaymentVocherListBySearchMiddleware,
  getDisbursementDetailsMiddleware,
  bulkPrintDisbursementsMiddleware,
  filterPaymentVoucherMiddleware,
} from "./paymentVocherMiddleware";

const initialState = {
  loading: false,
  error: "",
  paymentVocherList: [],
  paymentVocherFilterList: [],
  pagination: {
    currentPage: 1,
    pageSize: 10,
    totalRecords: 0,
    totalPages: 0
  },
  selectedInvoiceIds: [],
  selectedCommissionLineIds: [],
  currentDisbursementId: null,
  invoiceList: [
    {
      id: 1,
      VoucherNumber: "Voucher0123",
      TransactionNumber: "Trans00123",
      CustomerCode: "Cus01123",
      VoucheDate: "11/12/2023",
      Amount: "500.00",
      action: 1,
      fcamount: "500.00",
      discount: "400.00",
      vat: "200%",
      wht: "200%",
    },
    {
      id: 2,
      VoucherNumber: "Voucher0124",
      CustomerCode: "Cus01123",
      TransactionNumber: "Trans00124",
      VoucheDate: "12/12/2023",
      Amount: "600.00",
      action: 2,
      fcamount: "500.00",
      discount: "400.00",
      vat: "200%",
      wht: "200%",
    },
    {
      id: 3,
      VoucherNumber: "Voucher0125",
      TransactionNumber: "Trans00125",
      CustomerCode: "Cus01123",
      VoucheDate: "13/12/2023",
      Amount: "700.00",
      action: 3,
      fcamount: "500.00",
      discount: "400.00",
      vat: "200%",
      wht: "200%",
    },
    {
      id: 4,
      VoucherNumber: "Voucher0126",
      TransactionNumber: "Trans00126",
      CustomerCode: "Cus01123",
      VoucheDate: "14/12/2023",
      Amount: "800.00",
      action: 4,
      fcamount: "500.00",
      discount: "400.00",
      vat: "200%",
      wht: "200%",
    },
    {
      id: 5,
      VoucherNumber: "Voucher0127",
      TransactionNumber: "Trans00127",
      VoucheDate: "15/12/2023",
      CustomerCode: "Cus01123",
      Amount: "900.00",
      action: 5,
      fcamount: "500.00",
      discount: "400.00",
      vat: "200%",
      wht: "200%",
    },
    {
      id: 6,
      VoucherNumber: "Voucher0128",
      TransactionNumber: "Trans00128",
      VoucheDate: "16/12/2023",
      CustomerCode: "Cus01123",
      Amount: "1000.00",
      action: 6,
      fcamount: "500.00",
      discount: "400.00",
      vat: "200%",
      wht: "200%",
    },
    {
      id: 7,
      VoucherNumber: "Voucher0129",
      TransactionNumber: "Trans00129",
      VoucheDate: "17/12/2023",
      CustomerCode: "Cus01123",
      Amount: "1100.00",
      action: 7,
      fcamount: "500.00",
      discount: "400.00",
      vat: "200%",
      wht: "200%",
    },
    {
      id: 8,
      VoucherNumber: "Voucher0130",
      TransactionNumber: "Trans00130",
      VoucheDate: "18/12/2023",
      CustomerCode: "Cus01123",
      Amount: "1200.00",
      action: 8,
      fcamount: "500.00",
      discount: "400.00",
      vat: "200%",
      wht: "200%",
    },
    {
      id: 9,
      VoucherNumber: "Voucher0131",
      TransactionNumber: "Trans00131",
      VoucheDate: "19/12/2023",
      CustomerCode: "Cus01123",
      Amount: "1300.00",
      action: 9,
      fcamount: "500.00",
      discount: "400.00",
      vat: "200%",
      wht: "200%",
    },
    {
      id: 10,
      VoucherNumber: "Voucher0132",
      TransactionNumber: "Trans00132",
      VoucheDate: "20/12/2023",
      CustomerCode: "Cus01123",
      Amount: "1400.00",
      action: 0,
      fcamount: "500.00",
      discount: "400.00",
      vat: "200%",
      wht: "200%",
    },
  ],
  chequebooklist: [
    {
      id: 1,
      VoucherNumber: "Voucher0123",
      TransactionNumber: "Trans00123",
      CustomerCode: "Cus01123",
      VoucheDate: "11/12/2023",
      Amount: "500.00",
      action: "",
      status: "Printed",
    },
    {
      id: 2,
      VoucherNumber: "Voucher0123",
      CustomerCode: "Cus01123",
      TransactionNumber: "Trans00124",
      VoucheDate: "12/12/2023",
      Amount: "600.00",
      action: "",
      status: "Pending",
    },
    {
      id: 3,
      VoucherNumber: "Voucher0123",
      CustomerCode: "Cus01123",
      TransactionNumber: "Trans00124",
      VoucheDate: "12/12/2023",
      Amount: "600.00",
      action: "",
      status: "Approved",
    },
  ],
  paymentVocherSearchList: [],
  individualVoucher: {},
  disbursementDetails: null,
  bulkPrintLoading: false,
  bulkPrintData: null,
};
const paymentVoucherReducer = createSlice({
  name: "paymentVoucher",
  initialState,
  reducers: {
    clearData: (state) => {
      state.paymentVocherList = [];
      state.paymentVocherSearchList = [];
      state.error = "";
    },
    setSelectedInvoiceIds: (state, action) => {
      state.selectedInvoiceIds = action.payload;
    },
    setSelectedCommissionLineIds: (state, action) => {
      state.selectedCommissionLineIds = action.payload;
    },
    setCurrentDisbursementId: (state, action) => {
      state.currentDisbursementId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(paymentVocherMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(paymentVocherMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.paymentVocherList = action.payload.data;
      state.pagination = action.payload.pagination;
    });
    builder.addCase(paymentVocherMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.paymentVocherList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getPaymentVocherListBySearchMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPaymentVocherListBySearchMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.paymentVocherSearchList = action.payload;
    });
    builder.addCase(getPaymentVocherListBySearchMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.paymentVocherSearchList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(chequebookdetailsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(chequebookdetailsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.chequebooklist = action.payload;
    });
    builder.addCase(chequebookdetailsMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.paymentVocherList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getpaymentVocherByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getpaymentVocherByIdMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.individualVoucher = action.payload;
      }
    );
    builder.addCase(
      getpaymentVocherByIdMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.paymentVocherList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    builder.addCase(postpaymentVocherCreateDataMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postpaymentVocherCreateDataMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.paymentVocherList = [...state.paymentVocherList, action.payload];
      }
    );
    builder.addCase(
      postpaymentVocherCreateDataMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    builder.addCase(patchpaymentStatusByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchpaymentStatusByIdMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.chequebooklist = state.chequebooklist.map((item) => {
          if (item.id === action.payload) {
            if (item.status === "Pending") {
              return { ...item, status: "Approved" };
            } else if (item.status === "Approved") {
              return { ...item, status: "Printed" };
            }
          }
          return item;
        });
      }
    );
    builder.addCase(
      patchpaymentStatusByIdMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    builder.addCase(
      patchpaymentVocherInvoiceListMiddleware.pending,
      (state) => {
        state.loading = true;
      }
    );
    builder.addCase(
      patchpaymentVocherInvoiceListMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.invoiceList = state.invoiceList?.map((item) => {
          if (item.id === action.payload?.id) {
            return {
              ...item,
              fcamount: action.payload?.fcAmount,
              discount: action.payload?.discount,
              vat: action.payload?.vat,
              wht: action.payload?.wht,
            };
          }
          return item;
        });
      }
    );
    builder.addCase(
      patchpaymentVocherInvoiceListMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    
    // Disbursement details middleware cases
    builder.addCase(getDisbursementDetailsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getDisbursementDetailsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.disbursementDetails = action.payload;
    });
    builder.addCase(getDisbursementDetailsMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.disbursementDetails = null;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Bulk print disbursements
    builder.addCase(bulkPrintDisbursementsMiddleware.pending, (state) => {
      state.bulkPrintLoading = true;
    });
    builder.addCase(bulkPrintDisbursementsMiddleware.fulfilled, (state, action) => {
      state.bulkPrintLoading = false;
      state.bulkPrintData = action.payload;
    });
    builder.addCase(bulkPrintDisbursementsMiddleware.rejected, (state, action) => {
      state.bulkPrintLoading = false;
      state.bulkPrintData = null;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Filter disbursements
    builder.addCase(filterPaymentVoucherMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(filterPaymentVoucherMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.paymentVocherFilterList = action.payload.data;
      state.pagination = action.payload.pagination;
    });
    builder.addCase(filterPaymentVoucherMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.paymentVocherFilterList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default paymentVoucherReducer.reducer;
