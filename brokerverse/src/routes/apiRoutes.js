export const APIROUTES = {
  LOGIN: {
    POST_LOGIN: "user/user-login",
    POST_SIGNUP: "admin-signup",
  },
  DASHBOARD: {
    GET_DETAILS: "agent/get-dashboard-details",
  },
  QUOTE: {
    GET_VEHICLE_BRAND: "master/vehicle/get-brands",
    GET_VEHICLE_TYPE: "master/vehicle/get-vehicle-types",
    GET_VEHICLE_VARIANT: "master/vehicle/get-variants?model=",
    GET_VEHICLE_MODEL: "master/vehicle/get-models?brand=",
    GET_VEHICLE_SEATING_CAPACTITY: "master/vehicle/get-seating-capacity",
    GET_INSURANCE_COMPANY: "master/insurancecompany/get-insurance-companies",
    GET_BODILY_INJURY: "biCoverage/get-bi-coverage?PolicyTypeId=",
    GET_PROPERTY_DEMAGE: "pdCoverage/get-pd-coverages?PolicyTypeId=",
    GET_PERSONAL_ACCIDENT: "paCoverage/get-pa-coverages?PolicyTypeId=",
    POST_QUOTE_CREATE: "quote/create-quote",
    GET_POLICY_TYPE: "master/policyType/policy-type?productId=",
    GET_INSURANCE_COMPANYNAME:
      "master/insurancecompany/get-insurance-companies",
    GET_ACCOUNT_TYPE: "agent/get-sub-agents",
    GET_SIGNATURE: "master/signatory/get-all-signatory",
    GET_QUOTE_LIST: "quote/get-all-quote?LeadId=",
    DELETE_DELETE: "quote/delete-quote?quoteId=",
    POST_QUOTE_CALCULATION: "quote/calculate-premium-quote",
  },
  LEAD: {
    GET_COUNTRIES: "master/country/get-countries",
    GET_CITIES: "master/cities/get-cities",
    GET_STATES: "master/states/get-states",
    GET_ALL_LEAD: "lead/get-all-lead",
    GET_LEAD_BY_NAME: "lead/search-lead",
    POST_CREATE_LEAD: "leads", // Updated to match the API endpoint
    PUT_UPDATE_LEAD: "leads", // For updating leads
    GET_LEAD_BY_ID: "leads", // For getting lead by ID
    SEARCH_LEADS: "leads/search", // For searching leads
  },
  VECHILE: {
    PATCH_VECHILE_FORM3: "quote/update-policy-details",
    GET_VECHILE_FORM3: "quote/get-quote-details",
  },
  QUOTEDETAIL: {
    GET_QUOTE_DETAIL: "quote/get-quote-details?quoteId=",
    GET_MORTAGES: "master/banks/get-all-banks",
    GET_UPLODEURL: "upload/get-url/vehicle?quoteId=",
    PATCH_VEHICLEDETAIL: "vehicalDetails/update-vehicle-details",
    PATCH_VEHICLEUPLOAD: "vehicalDetails/update-vehicle-images/",
    GET_QUOTE_DETAIL: "quote/get-quote-details?quoteId=",
  },
  VECHICALQUOTEDETAIL: {
    GET_VECHICAL_QUOTE_DETAIL: "quote/get-quote-details?quoteId=",
    GET_UPLOAD_URL: "upload/get-url/id?quoteId=",
    PATCH_LEAD_DATA: "lead/update-lead",
  },
  VECHICALQUOTEDETAIL: {
    GET_VECHICAL_QUOTE_DETAIL: "quote/get-quote-details?quoteId=",
    GET_UPLOAD_URL: "upload/get-url/id?quoteId=",
    PATCH_LEAD_DATA: "lead/update-lead",
  },
  CLIENTMANAGEMENT: {
    CLIENT_MANAGEMENT: "client/get-all-client",
    GET_SEARCH_ALL_CLIENT: "client/search-all-client",
  },
  DOCUMENTUPLOAD: {
    POST_DOCUMENT_UPLOADE: "client/create-client",
    GET_DOCUMENT_UPLOAD_URL: "upload/get-url/document",
  },
  // CLIENTMANAGEMENT:{
  //  CLIENT_MANAGEMENT: "client/get-all-client",
  //  GET_SEARCH_ALL_CLIENT:"client/search-all-client"
  // },
  POLICYDETAILS: {
    GET_POLICY_DETAIL: "quote/get-quote-details?quoteId=",
    GET_BILL_NO: "billing/get-bill-no",
    POST_POLICYDETAIL: "policy/create-policy",
  },
  CLIENTPROFILE: {
    GET_CLIENT_PROFILE: "Client/get-client-profileDetails",
  },
  CLIENTDETAILS: {
    GET_CLIENT_DETAILS: "Client/get-client-by-id",
  },
  POLICYLIST: {
    GET_POLICY_LIST: "policy/get-policy-list",
    GET_SEARCH_POLICY_LIST: "policy/search-policy-list",
  },
  POLICYDEATILSVIEW: {
    // GET_POLICY_DETAILS_VIEW:""
    GET_POLICY_DETAILS_VIEW: "policy/get-indidual-policy-details?PolicyId=",
  },
  POLICYDOCUMENTVIEW: {
    GET_POLICY_DOCUMENT_VIEW: "policy/view-policy-documents?policyId=",
  },
  ENDROSEMENTLIST: {
    GET_ENDROSEMENT_LIST:
      "endorsements/get-All-Endorsements?clientId=13&endorsementId=&perPage=5&pageNo=1",
    GET_SEARCH_ENDROSEMENT_LIST: "",
  },
  CREATEENDROSMENT: {
    POST_ENDROSEMENT_FORM: "endorsements/create-endorsement",
    POST_ENDROSEMENT_FORM_TWO: "",
    POST_ENDROSEMENT_FORM_THREE: "",
    POST_ENDROSEMENT_FORM_FOUR: "",
    GET_ENDROSEMENT_FORM: "policy/get-indidual-policy-details?PolicyId=4",
  },
  GETENDROSEMENT: {
    GET_ENDROSEMENT_FORM_ONE: "",
    GET_ENDROSEMENT_FORM_TWO: "",
    GET_ENDROSEMENT_FORM_THREE: "",
    GET_ENDROSEMENT_FORM_FOUR: "",
  },
  GETUPLOADENDROSEMENT: {
    GET_UPLOADURL_ENDROSEMENT: "upload/get-url/endorsement?endorsementId=",
    POST_ENDROSEMENT_DATA: "endorsements/complete-endorsement",
    POST_PREMIUMCALCULATION: "quote/calculate-premium-quote",
  },
  GETCLAIMLIST: {
    GET_CLAIM_LIST: "claims/get-all-claim-search",
    GET_SEARCH_CLAIM_LIST: "claims/get-all-claim-search",
  },
  // GETCLAIMREQUESTSEND: {
  //   GET_CLAIM_DOCUMENT_UPLOAD_URL: "upload/get-url/claims?policyId="

  // },
  CLAIMDETAILS: {
    GET_CLAIM_DETAILS: "policy/policy-details-for-claims",
    POST_CLAIM_DETAILS: "claims/create-claim",
  },
  GETCLAIMREQUESTSEND: {
    GET_CLAIM_DOCUMENT_UPLOAD_URL: "upload/get-url/claims?policyId=",
  },
  CLAIMSETTLEMENTDEATIL: {
    GET_SETTLEMENT_UPLOAD: "upload/get-url/settlement?claimId=",
    POST_SETTLEMENT_DETAIL: "claims/complete-claim?claimId=",
  },
  JOURNALVOUCHER: {
    POST_APPROVE_JOURNAL_VOUCHER: "journal-vouchers",
    GET_JOURNAL_VOUCHER_HISTORY: "journal-vouchers/history",
    GET_JOURNAL_VOUCHER_DETAILS: "journal-vouchers",
  },
};
