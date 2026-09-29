import { useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { RadioButton } from "primereact/radiobutton";

export const VEHICLE_TYPE_OPTIONS = [
  { label: "AC and Tourist Cars", value: "ac_and_tourist_cars" },
  {
    label: "Heavy Trucks(Own goods) and Private buses over 3930 KGS.",
    value: "heavy_trucks",
  },
  {
    label: "Light /Medium trucks (Own goods) Not 3930 KGS.",
    value: "light_medium_trucks",
  },
  {
    label: "Motorcycles/Tricycles/Trailers",
    value: "motorcycles_tricycles",
  },
  { label: "PUB and tourist Bus", value: "pub_and_tourist_bus" },
  {
    label: "Private cars (including jeeps and Utility vehicles)",
    value: "private_cars",
  },
  { label: "Taxi,PUJ and Mini Bus", value: "taxi_puj_and_mini_bus" },
].map((label) => ({ label, value: label }));

const VEHICLE_VARIANT_OPTIONS = [
  "Automatic Transmission",
  "Manual Transmission",
].map((label) => ({ label, value: label }));

const VEHICLE_YEAR_OPTIONS = [
  "2026",
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
].map((label) => ({ label, value: label }));

const VEHICLE_BRAND_OPTIONS = [
  "Abarth",
  "Alfa Romeo",
  "Aston Martin",
  "Audi",
  "AITO",
  "Auto Nation Group (represents Chrysler, Dodge, Jeep, Ram)",
  "BAIC (Beijing Automotive Industry Holding)",
  "BMW",
  "BYD",
  "Cadillac",
  "Changan",
  "Chery",
  "Chevrolet",
  "Chrysler",
  "Citroën",
  "Dongfeng",
  "Dodge",
  "Ferrari",
  "Fiat",
  "Foton",
  "Ford",
  "Geely",
  "GWM (Great Wall Motors – includes Haval, Tank, Ora)",
  "Honda",
  "Hino",
  "Hyundai",
  "Haval (sub-brand of GWM)",
  "Isuzu",
  "Jaguar",
  "Jaecoo (Chery sub-brand)",
  "Jeep",
  "Jetour",
  "Kia",
  "King Long",
  "Lamborghini",
  "Land Rover",
  "Lexus",
  "Lynk & Co",
  "Maserati",
  "Maxus",
  "Mazda",
  "Mercedes-Benz",
  "MG (Morris Garages)",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Omoda (Chery sub-brand)",
  "Ora (GWM sub-brand)",
  "Peugeot",
  "Porsche",
  "Proton",
  "RAM",
  "Rolls-Royce",
  "SsangYong",
  "Subaru",
  "Suzuki",
  "Tata Motors",
  "Tesla (unofficial/gray market)",
  "Toyota",
  "Volkswagen",
  "Volvo",
].map((label) => ({ label, value: label }));

const VEHICLE_MODEL_OPTIONS = ["LT", "TT", "AU", "Q3", "Q5", "Q7", "A1"].map(
  (label) => ({ label, value: label })
);

const DISCOUNT_TYPE_OPTIONS = ["POLICY", "RISK", "COVER"].map((label) => ({
  label,
  value: label,
}));

const DISCOUNT_CODE_OPTIONS = ["PO01", "RI09", "CO98"].map((label) => ({
  label,
  value: label,
}));

const DISCOUNT_DESCRIPTION_OPTIONS = [
  "Deductible Discount",
  "No Claim bonous",
  "Comprehensive Discount",
  "Special Discount",
].map((label) => ({ label, value: label }));

const LOADING_DESCRIPTION_OPTIONS = [
  "Underage Loading (Less than 21 years)",
  "UW loading",
].map((label) => ({ label, value: label }));

const FIELD_COL_CLASS = "field col-12 md:col-6 lg:col-4 xl:col-3";
const LABEL_CLASS = "block mb-2";
const INPUT_CLASS = "w-full";

const OWN_DAMAGE_RATES_INPUT_OPTIONS = [
  { label: "AC and Tourist Cars", key: "ac_and_tourist_cars", value: "1.5" },
  { label: "Heavy Trucks", key: "heavy_trucks", value: "6" },
  { label: "Light /Medium trucks", key: "light_medium_trucks", value: "1.15" },
  { label: "Motorcycles/Tricycles", key: "motorcycles_tricycles", value: "1" },
  { label: "Pub and tourist Bus", key: "pub_and_tourist_bus", value: "5" },
  { label: "Private cars", key: "private_cars", value: "2" },
  {
    label: "Taxi,PUJ and Mini Bus",
    key: "taxi_puj_and_mini_bus",
    value: "2.5",
  },
];

const CTPL_PREMIUM_BY_VEHICLE_TYPE_INPUT_OPTIONS = [
  { label: "AC and Tourist Cars", key: "ac_and_tourist_cars", value: "957.88" },
  { label: "Heavy Trucks", key: "heavy_trucks", value: "957.88" },
  {
    label: "Light /Medium trucks",
    key: "light_medium_trucks",
    value: "957.88",
  },
  {
    label: "Motorcycles/Tricycles",
    key: "motorcycles_tricycles",
    value: "199.55",
  },
  { label: "Pub and tourist Bus", key: "pub_and_tourist_bus", value: "5%" },
  { label: "Private cars", key: "private_cars", value: "447.01" },
  {
    label: "Taxi,PUJ and Mini Bus",
    key: "taxi_puj_and_mini_bus",
    value: "486.92",
  },
];

const STATUTORY_TAXES_AND_FEES_INPUT_OPTIONS = [
  {
    label: "Documentary Stamp Tax (DST)",
    key: "documentary_stamp_tax",
    value: "0.5",
  },
  { label: "Value Added Tax (VAT)", key: "value_added_tax", value: "12" },
  {
    label: "Local Government Tax (LGT)",
    key: "local_government_tax",
    value: "5",
  },
];

const DRIVER_AGE_MULTIPLIERS_INPUT_OPTIONS = [
  { label: "Under 25 years old", key: "under_25_years_old", value: "1.5" },
  { label: "25 to 60 years old", key: "25_to_60_years_old", value: "1.0" },
  { label: "Over 60 years old", key: "over_60_years_old", value: "1.3" },
];

const VECHILE_DEPRECIATION_INPUT_OPTIONS = [
  {
    label: "Annual Depreciation Rate (%)",
    key: "annual_depreciation_rate",
    value: "10",
  },
  {
    label: "Maximum Depreciation Years",
    key: "maximum_depreciation_years",
    value: "10",
  },
];

const TAB_OPTIONS = [
  { label: "Risk Information", value: "riskInformation" },
  { label: "Premium Rates", value: "premiumRates" },
  { label: "CTPL Setting", value: "ctplSetting" },
  { label: "Taxes and Fees", value: "taxes" },
  { label: "Rating Factors", value: "ratingFactor" },
];

const SUB_TAB_OPTIONS = {
  riskInformation: [
    { label: "Vehicle Information", value: "vehicleInformation" },
    { label: "Discounts", value: "discount" },
    { label: "Loading", value: "loading" },
  ],
  premiumRates: [
    { label: "Own Damage Rates", value: "ownDamage" },
    { label: "Add-on Coverage Rates", value: "addOnCoverage" },
  ],
  ctplSetting: [
    { label: "CTPL Premium by Vehicle Type", value: "ctplPremium" },
  ],
  taxes: [{ label: "Statutory Taxes & Fees", value: "statutoryTaxes" }],
  ratingFactor: [
    { label: "Driver Age Multipliers", value: "driverAge" },
    { label: "Vehicle Depreciation", value: "vehicleDepreciation" },
  ],
};

const GENERAL_SUB_TAB = "general";

const getDefaultSubTab = (tab) =>
  SUB_TAB_OPTIONS[tab]?.[0]?.value || GENERAL_SUB_TAB;

const INPUT_TYPE_OPTIONS = [
  { label: "Text", value: "text" },
  { label: "Number", value: "number" },
  { label: "Select", value: "select" },
  { label: "Radio", value: "radio" },
];

const DATA_TYPE_OPTIONS = [
  { label: "String", value: "string" },
  { label: "Number", value: "number" },
  { label: "Boolean", value: "boolean" },
  { label: "Date", value: "date" },
];

const getInitialNewLabelForm = () => ({
  tab: TAB_OPTIONS[0]?.value || "riskInformation",
  subTab: getDefaultSubTab(TAB_OPTIONS[0]?.value || "riskInformation"),
  labelName: "",
  inputType: INPUT_TYPE_OPTIONS[0]?.value || "text",
  dataType: DATA_TYPE_OPTIONS[0]?.value || "string",
  options: "",
});

const ProductConfiguratorTab = ({
  selectedTemplate,
  setSelectedTemplate,
  saveTemplate,
}) => {
  const {
    riskInformation = {},
    premiumRates = {},
    ctplSetting = {},
    taxes = {},
    ratingFactor = {},
  } = selectedTemplate?.configuration;

  const [isAddLabelDialogVisible, setAddLabelDialogVisible] = useState(false);
  const [newLabelForm, setNewLabelForm] = useState(getInitialNewLabelForm);
  const [formErrors, setFormErrors] = useState({});

  const customFields = selectedTemplate?.configuration?.customFields || {};
  const customFieldValues =
    selectedTemplate?.configuration?.customFieldValues || {};

  const getNormalizedCustomFields = (
    tabKey,
    fieldsForTab = customFields[tabKey]
  ) => {
    if (Array.isArray(fieldsForTab)) {
      return { [getDefaultSubTab(tabKey)]: fieldsForTab };
    }
    return { ...(fieldsForTab || {}) };
  };

  const getNormalizedCustomFieldValues = (
    tabKey,
    valuesForTab = customFieldValues[tabKey]
  ) => {
    if (Array.isArray(valuesForTab)) {
      return { [getDefaultSubTab(tabKey)]: valuesForTab };
    }
    return { ...(valuesForTab || {}) };
  };

  const getSubTabLabel = (tabKey, subTabKey) =>
    SUB_TAB_OPTIONS[tabKey]?.find((option) => option.value === subTabKey)
      ?.label || "";

  const resetNewLabelForm = () => {
    setNewLabelForm(getInitialNewLabelForm());
    setFormErrors({});
  };

  const handleOpenAddLabelDialog = () => {
    resetNewLabelForm();
    setAddLabelDialogVisible(true);
  };

  const handleHideAddLabelDialog = () => {
    setAddLabelDialogVisible(false);
  };

  const handleNewLabelFormChange = (field, value) => {
    setNewLabelForm((prev) => {
      const nextState = {
        ...prev,
        [field]: value,
      };

      if (field === "tab") {
        nextState.subTab = getDefaultSubTab(value);
      }

      if (field === "subTab" && !value) {
        nextState.subTab = "";
      }

      return nextState;
    });
    setFormErrors((prev) => {
      if (!Object.keys(prev || {}).length) {
        return prev;
      }
      const updated = { ...prev };
      delete updated[field];
      if (field === "tab") {
        delete updated.subTab;
      }
      return Object.keys(updated).length ? updated : {};
    });
  };

  const createFieldKeyFromLabel = (label) =>
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "custom_field";

  const generateUniqueFieldKey = (tab, subTab, baseKey) => {
    const normalizedFields = getNormalizedCustomFields(tab);
    const effectiveSubTab = subTab || getDefaultSubTab(tab);
    const existingKeys = (normalizedFields[effectiveSubTab] || []).map(
      (field) => field.key
    );
    if (!existingKeys.includes(baseKey)) {
      return baseKey;
    }

    let index = 1;
    let candidate = `${baseKey}_${index}`;
    while (existingKeys.includes(candidate)) {
      index += 1;
      candidate = `${baseKey}_${index}`;
    }
    return candidate;
  };

  const handleCustomFieldChange = (tabKey, subTabKey, fieldKey, value) => {
    const effectiveSubTabKey = subTabKey || getDefaultSubTab(tabKey);
    const existingCustomFieldValues =
      selectedTemplate?.configuration?.customFieldValues || {};
    const normalizedTabValues = getNormalizedCustomFieldValues(
      tabKey,
      existingCustomFieldValues[tabKey]
    );

    setSelectedTemplate({
      ...selectedTemplate,
      configuration: {
        ...(selectedTemplate?.configuration || {}),
        customFieldValues: {
          ...existingCustomFieldValues,
          [tabKey]: {
            ...normalizedTabValues,
            [effectiveSubTabKey]: {
              ...(normalizedTabValues[effectiveSubTabKey] || {}),
              [fieldKey]: value,
            },
          },
        },
      },
    });
  };

  const handleAddLabelSubmit = () => {
    const { tab, subTab, labelName, inputType, dataType, options } =
      newLabelForm;
    const trimmedLabel = (labelName || "").trim();
    const trimmedOptions = (options || "").trim();
    const errors = {};

    if (!tab) {
      errors.tab = "Please select a tab.";
    }

    const normalizedSubTab = subTab || getDefaultSubTab(tab);

    if (!normalizedSubTab) {
      errors.subTab = "Please select a section.";
    }

    const availableSubTabs = SUB_TAB_OPTIONS[tab] || [];
    const subTabExists = availableSubTabs.some(
      (option) => option.value === normalizedSubTab
    );

    if (!subTabExists) {
      errors.subTab = "Section is not available for the selected tab.";
    }

    if (!trimmedLabel) {
      errors.labelName = "Label name is required.";
    }

    let parsedOptions = [];
    if (inputType === "select" || inputType === "radio") {
      parsedOptions = trimmedOptions
        .split(",")
        .map((option) => option.trim())
        .filter((option) => option.length > 0)
        .map((option) => ({ label: option, value: option }));

      if (!parsedOptions.length) {
        errors.options = "Provide at least one option.";
      }
    }

    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    const baseKey = createFieldKeyFromLabel(trimmedLabel);
    const uniqueKey = generateUniqueFieldKey(tab, normalizedSubTab, baseKey);

    const newField = {
      id: `${tab}_${normalizedSubTab}_${uniqueKey}`,
      label: trimmedLabel,
      key: uniqueKey,
      inputType,
      dataType,
      options: parsedOptions,
      subTab: normalizedSubTab,
    };

    const normalizedFields = getNormalizedCustomFields(tab);
    const updatedCustomFields = {
      ...customFields,
      [tab]: {
        ...normalizedFields,
        [normalizedSubTab]: [
          ...(normalizedFields[normalizedSubTab] || []),
          newField,
        ],
      },
    };

    const normalizedValues = getNormalizedCustomFieldValues(tab);
    const updatedCustomFieldValues = {
      ...(selectedTemplate?.configuration?.customFieldValues || {}),
      [tab]: {
        ...normalizedValues,
        [normalizedSubTab]: {
          ...(normalizedValues[normalizedSubTab] || {}),
          [uniqueKey]: "",
        },
      },
    };

    setSelectedTemplate({
      ...selectedTemplate,
      configuration: {
        ...(selectedTemplate?.configuration || {}),
        customFields: updatedCustomFields,
        customFieldValues: updatedCustomFieldValues,
      },
    });

    setAddLabelDialogVisible(false);
    resetNewLabelForm();
  };

  const getCustomFieldValue = (tabKey, subTabKey, fieldKey) => {
    const normalizedValues = getNormalizedCustomFieldValues(tabKey);
    return normalizedValues[subTabKey]?.[fieldKey] ?? "";
  };

  const renderCustomFieldInput = (field, tabKey, subTabKey) => {
    const value = getCustomFieldValue(tabKey, subTabKey, field.key);

    if (field.inputType === "select") {
      return (
        <Dropdown
          className={INPUT_CLASS}
          value={value || null}
          options={field.options || []}
          placeholder="Select"
          onChange={(e) =>
            handleCustomFieldChange(tabKey, subTabKey, field.key, e.value)
          }
          showClear
        />
      );
    }

    if (field.inputType === "radio") {
      if (!field.options?.length) {
        return <small className="p-error">No options configured.</small>;
      }

      return (
        <div className="flex flex-column gap-2">
          {(field.options || []).map((option) => {
            const radioId = `${field.key}_${option.value}`;
            return (
              <div key={option.value} className="flex align-items-center gap-2">
                <RadioButton
                  inputId={radioId}
                  name={field.key}
                  value={option.value}
                  onChange={(e) =>
                    handleCustomFieldChange(
                      tabKey,
                      subTabKey,
                      field.key,
                      e.value
                    )
                  }
                  checked={value === option.value}
                />
                <label htmlFor={radioId}>{option.label}</label>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <InputText
        className={INPUT_CLASS}
        value={value}
        type={field.inputType === "number" ? "number" : "text"}
        onChange={(e) =>
          handleCustomFieldChange(tabKey, subTabKey, field.key, e.target.value)
        }
      />
    );
  };

  const renderCustomFieldsForSection = (tabKey, subTabKey) => {
    const normalizedFields = getNormalizedCustomFields(
      tabKey,
      customFields[tabKey]
    );
    const fields = normalizedFields[subTabKey] || [];

    if (!fields.length) {
      return null;
    }

    const handleDeleteField = (id) => {
      const currentFields = [...fields];
      const updatedFieldsForSubTab = currentFields.filter(
        (field) => field.id !== id
      );

      const normalizedValues = getNormalizedCustomFieldValues(
        tabKey,
        customFieldValues[tabKey]
      );
      const updatedValuesForSubTab = { ...(normalizedValues[subTabKey] || {}) };
      const fieldToRemove = currentFields.find((field) => field.id === id);
      if (fieldToRemove) {
        delete updatedValuesForSubTab[fieldToRemove.key];
      }

      setSelectedTemplate({
        ...selectedTemplate,
        configuration: {
          ...(selectedTemplate?.configuration || {}),
          customFields: {
            ...customFields,
            [tabKey]: {
              ...getNormalizedCustomFields(tabKey, customFields[tabKey]),
              [subTabKey]: updatedFieldsForSubTab,
            },
          },
          customFieldValues: {
            ...(selectedTemplate?.configuration?.customFieldValues || {}),
            [tabKey]: {
              ...getNormalizedCustomFieldValues(
                tabKey,
                customFieldValues[tabKey]
              ),
              [subTabKey]: updatedValuesForSubTab,
            },
          },
        },
      });
    };

    return (
      <div className="mt-3">
        <h5 className="mb-2">Custom Fields</h5>
        <div className="formgrid grid">
          {fields.map((field) => (
            <div
              key={field.id}
              className={`${FIELD_COL_CLASS} flex flex-column gap-2`}
            >
              <label className={`${LABEL_CLASS} capitalize`}>
                {field.label}
              </label>
              <div className="flex align-items-start gap-2">
                <div className="flex-1">
                  {renderCustomFieldInput(field, tabKey, subTabKey)}
                </div>
                <Button
                  label=""
                  icon="pi pi-trash"
                  onClick={() => handleDeleteField(field.id)}
                  className="p-button-text p-button-danger"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const updateVehicleInformation = (field, value) => {
    setSelectedTemplate({
      ...selectedTemplate,
      configuration: {
        ...(selectedTemplate?.configuration || {}),
        riskInformation: {
          ...(selectedTemplate?.configuration?.riskInformation || {}),
          vehicleInformation: {
            ...(selectedTemplate?.configuration?.riskInformation
              ?.vehicleInformation || {}),
            [field]: value,
          },
        },
      },
    });
  };

  const updateDiscountDetails = (field, value) => {
    setSelectedTemplate({
      ...selectedTemplate,
      configuration: {
        ...(selectedTemplate?.configuration || {}),
        riskInformation: {
          ...(selectedTemplate?.configuration?.riskInformation || {}),
          discount: {
            ...(selectedTemplate?.configuration?.riskInformation?.discount ||
              {}),
            [field]: value,
          },
          loading: {
            ...(selectedTemplate?.configuration?.riskInformation?.loading ||
              {}),
          },
        },
      },
    });
  };

  const updateLoadingDetails = (field, value) => {
    setSelectedTemplate({
      ...selectedTemplate,
      configuration: {
        ...(selectedTemplate?.configuration || {}),
        riskInformation: {
          ...(selectedTemplate?.configuration?.riskInformation || {}),
          discount: {
            ...(selectedTemplate?.configuration?.riskInformation?.discount ||
              {}),
          },
          loading: {
            ...(selectedTemplate?.configuration?.riskInformation?.loading ||
              {}),
            [field]: value,
          },
        },
      },
    });
  };

  const handleDiscountTypeChange = (value) => {
    setSelectedTemplate({
      ...selectedTemplate,
      configuration: {
        ...(selectedTemplate?.configuration || {}),
        riskInformation: {
          ...(selectedTemplate?.configuration?.riskInformation || {}),
          discount: {
            ...(selectedTemplate?.configuration?.riskInformation?.discount ||
              {}),
            type: value,
          },
          loading: {
            ...(selectedTemplate?.configuration?.riskInformation?.loading ||
              {}),
            type: value,
          },
        },
      },
    });
  };

  const handlePremiumRatesChange = (field, value) => {
    setSelectedTemplate({
      ...selectedTemplate,
      configuration: {
        ...(selectedTemplate?.configuration || {}),
        premiumRates: {
          ...(selectedTemplate?.configuration?.premiumRates || {}),
          [field]: value,
        },
      },
    });
  };

  const handleCTPLSettingChange = (field, value) => {
    setSelectedTemplate({
      ...selectedTemplate,
      configuration: {
        ...(selectedTemplate?.configuration || {}),
        ctplSetting: {
          ...(selectedTemplate?.configuration?.ctplSetting || {}),
          [field]: value,
        },
      },
    });
  };

  const handleTaxesAndFeesChange = (field, value) => {
    setSelectedTemplate({
      ...selectedTemplate,
      configuration: {
        ...(selectedTemplate?.configuration || {}),
        taxes: {
          ...(selectedTemplate?.configuration?.taxes || {}),
          [field]: value,
        },
      },
    });
  };

  const handleRatingFactorChange = (field, value) => {
    setSelectedTemplate({
      ...selectedTemplate,
      configuration: {
        ...(selectedTemplate?.configuration || {}),
        ratingFactor: {
          ...(selectedTemplate?.configuration?.ratingFactor || {}),
          [field]: value,
        },
      },
    });
  };

  return (
    <>
      <div className="flex justify-content-end gap-2">
        <Button
          label="Add Label"
          icon="pi pi-plus"
          className="p-button-outlined"
          onClick={handleOpenAddLabelDialog}
        />
      </div>
      <TabView>
        <TabPanel header="Risk Information">
          <div className="mt-4">
            <h4>Vehicle Information</h4>
            <div className="formgrid grid">
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Vehicle Type</label>
                <Dropdown
                  className={INPUT_CLASS}
                  value={
                    riskInformation?.vehicleInformation?.vehicleType || null
                  }
                  options={VEHICLE_TYPE_OPTIONS.map((e) => e.label)}
                  placeholder="Select Vehicle Type"
                  onChange={(e) =>
                    updateVehicleInformation("vehicleType", e.value)
                  }
                  showClear
                  filter
                />
              </div>
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Variant</label>
                <Dropdown
                  className={INPUT_CLASS}
                  value={riskInformation?.vehicleInformation?.variant || null}
                  options={VEHICLE_VARIANT_OPTIONS}
                  placeholder="Select Variant"
                  onChange={(e) => updateVehicleInformation("variant", e.value)}
                  showClear
                />
              </div>
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Manufactured Year</label>
                <Dropdown
                  className={INPUT_CLASS}
                  value={
                    riskInformation?.vehicleInformation?.manufacturedYear ||
                    null
                  }
                  options={VEHICLE_YEAR_OPTIONS}
                  placeholder="Select Year"
                  onChange={(e) =>
                    updateVehicleInformation("manufacturedYear", e.value)
                  }
                  showClear
                />
              </div>
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Brand</label>
                <Dropdown
                  className={INPUT_CLASS}
                  value={riskInformation?.vehicleInformation?.brand || null}
                  options={VEHICLE_BRAND_OPTIONS}
                  placeholder="Select Brand"
                  onChange={(e) => updateVehicleInformation("brand", e.value)}
                  showClear
                  filter
                />
              </div>
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Model</label>
                <Dropdown
                  className={INPUT_CLASS}
                  value={riskInformation?.vehicleInformation?.model || null}
                  options={VEHICLE_MODEL_OPTIONS}
                  placeholder="Select Model"
                  onChange={(e) => updateVehicleInformation("model", e.value)}
                  showClear
                />
              </div>
            </div>
          </div>

          {renderCustomFieldsForSection(
            "riskInformation",
            "vehicleInformation"
          )}

          <div className="mt-4">
            <h4>Discounts </h4>
            <div className="formgrid grid">
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Type</label>
                <Dropdown
                  className={INPUT_CLASS}
                  value={riskInformation?.discount?.type || null}
                  options={DISCOUNT_TYPE_OPTIONS}
                  placeholder="Select Type"
                  onChange={(e) => handleDiscountTypeChange(e.value)}
                />
              </div>
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Discount Code</label>
                <Dropdown
                  className={INPUT_CLASS}
                  value={riskInformation?.discount?.discountCode || null}
                  options={DISCOUNT_CODE_OPTIONS}
                  placeholder="Select Discount Code"
                  onChange={(e) =>
                    updateDiscountDetails("discountCode", e.value)
                  }
                />
              </div>
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Description</label>
                <Dropdown
                  className={INPUT_CLASS}
                  value={riskInformation?.discount?.description || null}
                  options={DISCOUNT_DESCRIPTION_OPTIONS}
                  placeholder="Select Description"
                  onChange={(e) =>
                    updateDiscountDetails("description", e.value)
                  }
                />
              </div>
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Rate</label>
                <InputText
                  className={INPUT_CLASS}
                  value={riskInformation?.discount?.rate ?? ""}
                  placeholder="Auto populate"
                  onChange={(e) =>
                    updateDiscountDetails("rate", e.target.value)
                  }
                />
              </div>
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Amount</label>
                <InputText
                  className={INPUT_CLASS}
                  value={riskInformation?.discount?.amount ?? ""}
                  placeholder="Auto populate"
                  onChange={(e) =>
                    updateDiscountDetails("amount", e.target.value)
                  }
                />
              </div>
            </div>

            {renderCustomFieldsForSection("riskInformation", "discount")}

            <h4 className="mt-4">Loading</h4>
            <div className="formgrid grid">
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Type</label>
                <InputText
                  className={INPUT_CLASS}
                  value={riskInformation?.loading?.type || ""}
                  onChange={(e) => updateLoadingDetails("type", e.target.value)}
                  placeholder="Auto populate from discount type"
                />
              </div>
              <div className={FIELD_COL_CLASS}>
                <label className={LABEL_CLASS}>Description</label>
                <Dropdown
                  className={INPUT_CLASS}
                  value={riskInformation?.loading?.description || null}
                  options={LOADING_DESCRIPTION_OPTIONS}
                  placeholder="Select Description"
                  onChange={(e) => updateLoadingDetails("description", e.value)}
                />
              </div>
            </div>
          </div>

          {renderCustomFieldsForSection("riskInformation", "loading")}
        </TabPanel>
        <TabPanel header="Premium Rates ">
          <div className="mt-4">
            <h4>Own Damage(% of Vehicle Value) </h4>
            <div className="formgrid grid">
              {OWN_DAMAGE_RATES_INPUT_OPTIONS.map((option) => (
                <div key={option.key} className="field col-12 lg:col-6">
                  <label className={LABEL_CLASS}>{option.label}</label>
                  <InputText
                    className={INPUT_CLASS}
                    value={premiumRates[option?.key] ?? option.value}
                    onChange={(e) => {
                      handlePremiumRatesChange(option?.key, e.target.value);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {renderCustomFieldsForSection("premiumRates", "ownDamage")}

          <div className="mt-4">
            <h4> Add-on Coverage Rates </h4>
            <div className="formgrid grid">
              <div className="field col-12 lg:col-6">
                <label className={LABEL_CLASS}>Acts of Nature (%)</label>
                <InputText
                  className={INPUT_CLASS}
                  value={premiumRates.acts_of_nature}
                  onChange={(e) => {
                    handlePremiumRatesChange("acts_of_nature", e.target.value);
                  }}
                />
              </div>

              <div className="field col-12 lg:col-6">
                <label className={LABEL_CLASS}>Roadside Assistance (%)</label>
                <InputText
                  className={INPUT_CLASS}
                  value={premiumRates.roadside_assistance}
                  onChange={(e) => {
                    handlePremiumRatesChange(
                      "roadside_assistance",
                      e.target.value
                    );
                  }}
                />
              </div>
              <div className="field col-12 lg:col-6">
                <label className={LABEL_CLASS}>
                  Personal Accident Cover (%)
                </label>
                <InputText
                  className={INPUT_CLASS}
                  value={premiumRates.personal_accident_cover}
                  onChange={(e) => {
                    handlePremiumRatesChange(
                      "personal_accident_cover",
                      e.target.value
                    );
                  }}
                />
              </div>
            </div>
          </div>

          {renderCustomFieldsForSection("premiumRates", "addOnCoverage")}
        </TabPanel>
        <TabPanel header="CTPL setting">
          <div className="mt-4">
            <h4>CTPL Premium by Vehicle Type </h4>
            <div className="formgrid grid">
              {CTPL_PREMIUM_BY_VEHICLE_TYPE_INPUT_OPTIONS.map((option) => (
                <div key={option.key} className="field col-12 lg:col-6">
                  <label className={LABEL_CLASS}>{option.label}</label>
                  <InputText
                    className={INPUT_CLASS}
                    value={ctplSetting[option?.key] ?? option.value}
                    onChange={(e) => {
                      handleCTPLSettingChange(option?.key, e.target.value);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {renderCustomFieldsForSection("ctplSetting", "ctplPremium")}
        </TabPanel>

        <TabPanel header="Taxes and fees ">
          <div className="mt-4">
            <h4>Statutory Taxes & Fees (%) </h4>
            <div className="formgrid grid">
              {STATUTORY_TAXES_AND_FEES_INPUT_OPTIONS.map((option) => (
                <div key={option.key} className="field col-12 lg:col-6">
                  <label className={LABEL_CLASS}>{option.label}</label>
                  <InputText
                    className={INPUT_CLASS}
                    value={taxes[option?.key] ?? option.value}
                    onChange={(e) => {
                      handleTaxesAndFeesChange(option?.key, e.target.value);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {renderCustomFieldsForSection("taxes", "statutoryTaxes")}
        </TabPanel>

        <TabPanel header="Rating Factors ">
          <div className="mt-4">
            <h4>Driver Age Multipliers</h4>
            <div className="formgrid grid">
              {DRIVER_AGE_MULTIPLIERS_INPUT_OPTIONS.map((option) => (
                <div key={option.key} className="field col-12 lg:col-6">
                  <label className={LABEL_CLASS}>{option.label}</label>
                  <InputText
                    className={INPUT_CLASS}
                    value={ratingFactor[option?.key] ?? option.value}
                    onChange={(e) => {
                      handleRatingFactorChange(option?.key, e.target.value);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {renderCustomFieldsForSection("ratingFactor", "driverAge")}
          <div className="mt-4">
            <h4>Vehicle Depreciation</h4>
            <div className="formgrid grid">
              {VECHILE_DEPRECIATION_INPUT_OPTIONS.map((option) => (
                <div key={option.key} className="field col-12 lg:col-6">
                  <label className={LABEL_CLASS}>{option.label}</label>
                  <InputText
                    className={INPUT_CLASS}
                    value={ratingFactor[option?.key] ?? option.value}
                    onChange={(e) => {
                      handleRatingFactorChange(option?.key, e.target.value);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {renderCustomFieldsForSection("ratingFactor", "vehicleDepreciation")}
        </TabPanel>
      </TabView>

      <div className=" mt-4">
        <div className="flex gap-2">
          <Button
            label="Save Template"
            icon="pi pi-save"
            onClick={saveTemplate}
          />
        </div>
      </div>

      <Dialog
        header="Add Label"
        visible={isAddLabelDialogVisible}
        style={{ width: "35rem" }}
        breakpoints={{ "960px": "75vw", "640px": "95vw" }}
        onHide={handleHideAddLabelDialog}
        footer={
          <div className="flex justify-content-end gap-2">
            <Button
              label="Cancel"
              className="p-button-text"
              onClick={handleHideAddLabelDialog}
            />
            <Button
              label="Add"
              icon="pi pi-check"
              onClick={handleAddLabelSubmit}
            />
          </div>
        }
      >
        <div className="p-fluid formgrid grid">
          <div className="field col-12">
            <label className={LABEL_CLASS}>Select Tab</label>
            <Dropdown
              className={INPUT_CLASS}
              value={newLabelForm.tab}
              options={TAB_OPTIONS}
              onChange={(e) => handleNewLabelFormChange("tab", e.value)}
              placeholder="Select Tab"
            />
            {formErrors.tab ? (
              <small className="p-error">{formErrors.tab}</small>
            ) : null}
          </div>
          {SUB_TAB_OPTIONS[newLabelForm.tab]?.length ? (
            <div className="field col-12">
              <label className={LABEL_CLASS}>Section</label>
              <Dropdown
                className={INPUT_CLASS}
                value={newLabelForm.subTab}
                options={SUB_TAB_OPTIONS[newLabelForm.tab] || []}
                onChange={(e) => handleNewLabelFormChange("subTab", e.value)}
                placeholder="Select section"
              />
              {formErrors.subTab ? (
                <small className="p-error">{formErrors.subTab}</small>
              ) : null}
            </div>
          ) : null}
          <div className="field col-12">
            <label className={LABEL_CLASS}>Label Name</label>
            <InputText
              className={INPUT_CLASS}
              value={newLabelForm.labelName}
              onChange={(e) =>
                handleNewLabelFormChange("labelName", e.target.value)
              }
              placeholder="Enter label name"
            />
            {formErrors.labelName ? (
              <small className="p-error">{formErrors.labelName}</small>
            ) : null}
          </div>
          <div className="field col-12 md:col-6">
            <label className={LABEL_CLASS}>Input Type</label>
            <Dropdown
              className={INPUT_CLASS}
              value={newLabelForm.inputType}
              options={INPUT_TYPE_OPTIONS}
              onChange={(e) => handleNewLabelFormChange("inputType", e.value)}
            />
          </div>
          <div className="field col-12 md:col-6">
            <label className={LABEL_CLASS}>Data Type</label>
            <Dropdown
              className={INPUT_CLASS}
              value={newLabelForm.dataType}
              options={DATA_TYPE_OPTIONS}
              onChange={(e) => handleNewLabelFormChange("dataType", e.value)}
            />
          </div>
          {(newLabelForm.inputType === "select" ||
            newLabelForm.inputType === "radio") && (
            <div className="field col-12">
              <label className={LABEL_CLASS}>Options (comma separated)</label>
              <InputText
                className={INPUT_CLASS}
                value={newLabelForm.options}
                onChange={(e) =>
                  handleNewLabelFormChange("options", e.target.value)
                }
                placeholder="Example: Option 1, Option 2"
              />
              {formErrors.options ? (
                <small className="p-error">{formErrors.options}</small>
              ) : null}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
};

export default ProductConfiguratorTab;
