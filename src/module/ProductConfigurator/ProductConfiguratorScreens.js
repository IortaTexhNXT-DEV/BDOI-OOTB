// Consolidated Product Configurator Screens Implementation
// Comprehensive product management for insurance brokers

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { TabView, TabPanel } from "primereact/tabview";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { MultiSelect } from "primereact/multiselect";
import { Checkbox } from "primereact/checkbox";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { Panel } from "primereact/panel";
import { Accordion, AccordionTab } from "primereact/accordion";
import { TreeTable } from "primereact/treetable";
import { Chips } from "primereact/chips";
import { Steps } from "primereact/steps";
import { Timeline } from "primereact/timeline";
import { ProgressBar } from "primereact/progressbar";
import { Chart } from "primereact/chart";
import productConfiguratorMockService from "../../services/mockData/productConfiguratorMockData";
import productConfiguratorService from "../../services/productConfiguratorService";
import ProductConfiguratorTab from "./PoductConfiguratorTab/ProductConfiguratorTab";
import { fetchProductTemplateByIdMiddleware } from "./store/productConfiguratorMiddleware";
import { clearProductTemplate } from "./store/productConfiguratorSlice";

// PC-2: Product Template Management
export const ProductTemplateManager = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [showDialog, setShowDialog] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const toast = useRef(null);
  const navigate = useNavigate();
  const { id } = useParams();
  const dispatch = useDispatch();
  const {
    template: templateFromStore,
    loading: templateLoading,
    error: templateError,
  } = useSelector((state) => state.productConfiguratorReducer || {});

  const categoryOptions = [
    { label: t("productTemplateManager.motor"), value: "Motor" },
    { label: t("productTemplateManager.fireAndAlliedPerils"), value: "Fire and Allied Perils" },
    { label: t("productTemplateManager.health"), value: "Health" },
    { label: t("productTemplateManager.property"), value: "Property" },
    { label: t("productTemplateManager.travel"), value: "Travel" },
    { label: t("productTemplateManager.marine"), value: "Marine" },
    { label: t("productTemplateManager.employeeBenefits"), value: "Employee Benefits" },
  ];

  const statusOptions = [
    { label: t("productTemplateManager.active"), value: "Active" },
    { label: t("productTemplateManager.inactive"), value: "Inactive" },
    { label: t("productTemplateManager.draft"), value: "Draft" },
  ];

  useEffect(() => {
    loadTemplates();

    return () => {
      dispatch(clearProductTemplate());
    };
  }, [dispatch]);

  useEffect(() => {
    if (id) {
      dispatch(
        fetchProductTemplateByIdMiddleware({
          templateId: id,
        })
      );
    } else {
      dispatch(clearProductTemplate());
      setSelectedTemplate(null);
    }
  }, [id, dispatch]);

  useEffect(() => {
    if (id && templateFromStore) {
      setSelectedTemplate(templateFromStore);
    }
  }, [id, templateFromStore]);

  useEffect(() => {
    if (templateError) {
      toast.current?.show({
        severity: "error",
        summary: t("productTemplateManager.error"),
        detail: templateError,
      });
    }
  }, [templateError, t]);

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const data = await productConfiguratorService.getProductTemplates();

      setTemplates(data);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("productTemplateManager.error"),
        detail: t("productTemplateManager.failedToLoadTemplates"),
      });
    } finally {
      setTemplatesLoading(false);
    }
  };

  const saveTemplate = async () => {
    try {
      if (!selectedTemplate) {
        return;
      }

      const fieldLabels = {
        templateCode: t("productTemplateManager.templateCode"),
        name: t("productTemplateManager.productName"),
        category: t("productTemplateManager.category"),
        lineOfBusiness: t("productTemplateManager.lineOfBusiness"),
        effectiveDate: t("productTemplateManager.effectiveDate"),
        status: t("productTemplateManager.status"),
      };

      const requiredFields = Object.keys(fieldLabels);

      const missingFields = requiredFields.filter((field) => {
        const value = selectedTemplate[field];
        if (field === "effectiveDate") {
          if (!value) {
            return true;
          }
          if (value instanceof Date) {
            return Number.isNaN(value.getTime());
          }
          return typeof value !== "string" || value.trim() === "";
        }
        if (typeof value === "string") {
          return value.trim() === "";
        }
        return value === undefined || value === null;
      });

      if (missingFields.length) {
        const formattedFields = missingFields.map(
          (field) => fieldLabels[field] || field
        );
        toast.current?.show({
          severity: "warn",
          summary: t("productTemplateManager.validation"),
          detail: t("productTemplateManager.pleaseFillIn", {
            fields: formattedFields.join(", "),
          }),
        });
        return;
      }

      const {
        templateCode,
        name,
        category,
        lineOfBusiness,
        effectiveDate,
        status,
        description,
      } = selectedTemplate;

      const formattedEffectiveDate =
        effectiveDate instanceof Date
          ? effectiveDate.toISOString().split("T")[0]
          : effectiveDate;

      const payload = {
        templateCode,
        name,
        category,
        lineOfBusiness,
        effectiveDate: formattedEffectiveDate,
        status,
        description: description || "",
      };

      if (selectedTemplate?.id) {
        await productConfiguratorService.updateProductTemplate({
          ...selectedTemplate,
          ...payload,
        });
      } else {
        await productConfiguratorService.createProductTemplate(payload);
      }

      toast.current?.show({
        severity: "success",
        summary: t("productTemplateManager.success"),
        detail: selectedTemplate?.id
          ? t("productTemplateManager.templateUpdated")
          : t("productTemplateManager.templateSaved"),
      });
      setShowDialog(false);
      setSelectedTemplate(null);
      dispatch(clearProductTemplate());
      loadTemplates();
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("productTemplateManager.error"),
        detail: error?.message || t("productTemplateManager.failedToSaveTemplate"),
      });
    }
  };

  return (
    <div className="product-template-manager p-3">
      <Toast ref={toast} />
      <Card title={t("productTemplateManager.cardTitle")}>
        {!id ? (
          <>
            <div>
              <div className="mb-3 flex justify-content-between">
                <h3>{t("productTemplateManager.productTemplates")}</h3>
                <Button
                  label={t("productTemplateManager.createTemplate")}
                  icon="pi pi-plus"
                  onClick={() => {
                    setSelectedTemplate({ status: "Active" });
                    setShowDialog(true);
                  }}
                />
              </div>
              <DataTable
                value={templates}
                loading={templatesLoading}
                paginator
                rows={10}
              >
                <Column field="templateCode" header={t("productTemplateManager.templateCode")} sortable />
                <Column field="name" header={t("productTemplateManager.productName")} sortable />
                <Column field="category" header={t("productTemplateManager.category")} sortable />
                <Column field="version" header={t("productTemplateManager.version")} sortable />
                <Column
                  field="status"
                  header={t("productTemplateManager.status")}
                  body={(rowData) => (
                    <Tag
                      value={rowData.status}
                      severity={
                        rowData.status === "Active" ? "success" : "warning"
                      }
                    />
                  )}
                />
                <Column
                  body={(rowData) => (
                    <Button
                      icon="pi pi-pencil"
                      className="p-button-text"
                      onClick={() => {
                        navigate(
                          `/product-configurator/template/${rowData.id}`
                        );
                        setSelectedTemplate(rowData);
                      }}
                    />
                  )}
                />
              </DataTable>
            </div>
            {/* <div className="field">
              <label>Category</label>
              <Dropdown
                value={selectedTemplate?.category || null}
                options={categoryOptions}
                placeholder={t("productTemplateManager.selectCategory")}
                onChange={(e) =>
                  setSelectedTemplate((prev) => ({
                    ...prev,
                    category: e.value,
                  }))
                }
                disabled={!!id}
              />
            </div>
            <div className="field">
              <label>Line of Business</label>
              <InputText
                value={selectedTemplate?.lineOfBusiness || ""}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    lineOfBusiness: e.target.value,
                  })
                }
                placeholder="e.g. Motor Vehicle"
              />
            </div>
            <div className="field">
              <label>Effective Date</label>
              <Calendar
                value={
                  selectedTemplate?.effectiveDate
                    ? new Date(selectedTemplate.effectiveDate)
                    : null
                }
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    effectiveDate: e.value,
                  })
                }
                showIcon
                dateFormat="yy-mm-dd"
                placeholder={t("productTemplateManager.selectEffectiveDate")}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <Dropdown
                value={selectedTemplate?.status || null}
                options={statusOptions}
                placeholder={t("productTemplateManager.selectStatus")}
                onChange={(e) =>
                  setSelectedTemplate((prev) => ({
                    ...prev,
                    status: e.value,
                  }))
                }
                disabled={!!id && templateLoading}
              />
            </div> */}
          </>
        ) : (
          <div>
            <Button
              label={t("productTemplateManager.back")}
              icon="pi pi-arrow-left"
              className="mb-3 p-button-text"
              onClick={() => navigate("/product-configurator/templates")}
            />
            {selectedTemplate && (
              <ProductConfiguratorTab
                selectedTemplate={selectedTemplate}
                setSelectedTemplate={setSelectedTemplate}
                saveTemplate={saveTemplate}
              />
            )}
          </div>
        )}
      </Card>

      <Dialog
        header={t("productTemplateManager.createProductTemplate")}
        visible={showDialog}
        style={{ width: "50vw" }}
        onHide={() => {
          setShowDialog(false);
          setSelectedTemplate(null);
        }}
      >
        <div className="p-fluid">
          <div className="field">
            <label>{t("productTemplateManager.templateCode")}</label>
            <InputText
              value={selectedTemplate?.templateCode || ""}
              onChange={(e) =>
                setSelectedTemplate({
                  ...selectedTemplate,
                  templateCode: e.target.value,
                })
              }
            />
          </div>
          <div className="field">
            <label>{t("productTemplateManager.productName")}</label>
            <InputText
              value={selectedTemplate?.name || ""}
              onChange={(e) =>
                setSelectedTemplate({
                  ...selectedTemplate,
                  name: e.target.value,
                })
              }
            />
          </div>
          <div className="field">
            <label>{t("productTemplateManager.description")}</label>
            <InputTextarea
              value={selectedTemplate?.description || ""}
              rows={3}
              onChange={(e) =>
                setSelectedTemplate({
                  ...selectedTemplate,
                  description: e.target.value,
                })
              }
            />
          </div>
          <div className="formgrid grid">
            <div className="field col-12 md:col-6">
              <label>{t("productTemplateManager.category")}</label>
              <Dropdown
                value={selectedTemplate?.category || null}
                options={categoryOptions}
                placeholder={t("productTemplateManager.selectCategory")}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    category: e.value,
                  })
                }
                showClear
              />
            </div>
            <div className="field col-12 md:col-6">
              <label>{t("productTemplateManager.lineOfBusiness")}</label>
              <InputText
                value={selectedTemplate?.lineOfBusiness || ""}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    lineOfBusiness: e.target.value,
                  })
                }
                placeholder={t("productTemplateManager.lineOfBusinessPlaceholder")}
              />
            </div>
            <div className="field col-12 md:col-6">
              <label>{t("productTemplateManager.effectiveDate")}</label>
              <Calendar
                value={
                  selectedTemplate?.effectiveDate
                    ? new Date(selectedTemplate.effectiveDate)
                    : null
                }
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    effectiveDate: e.value,
                  })
                }
                showIcon
                dateFormat="yy-mm-dd"
                placeholder={t("productTemplateManager.selectEffectiveDate")}
              />
            </div>
            <div className="field col-12 md:col-6">
              <label>{t("productTemplateManager.status")}</label>
              <Dropdown
                value={selectedTemplate?.status || "Active"}
                options={statusOptions}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    status: e.value,
                  })
                }
              />
            </div>
          </div>
          <Button
            label={selectedTemplate?.id ? t("productTemplateManager.update") : t("productTemplateManager.create")}
            icon={selectedTemplate?.id ? "pi pi-save" : "pi pi-plus"}
            onClick={saveTemplate}
            disabled={templateLoading}
          />
        </div>
      </Dialog>
    </div>
  );
};

// PC-3: Coverage Builder
export const CoverageBuilder = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const [coverages, setCoverages] = useState([]);
  const [selectedCoverage, setSelectedCoverage] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useRef(null);

  const typeOptions = [
    { label: t("coverageBuilder.mandatory"), value: "Mandatory" },
    { label: t("coverageBuilder.optional"), value: "Optional" },
  ];

  useEffect(() => {
    loadCoverages();
  }, []);

  const loadCoverages = async () => {
    setLoading(true);
    try {
      const data =
        await productConfiguratorMockService.getCoverageConfigurations();
      setCoverages(data);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("coverageBuilder.error"),
        detail: t("coverageBuilder.failedToLoad"),
      });
    } finally {
      setLoading(false);
    }
  };

  const saveCoverage = async () => {
    try {
      await productConfiguratorMockService.createCoverage(selectedCoverage);
      toast.current?.show({
        severity: "success",
        summary: t("coverageBuilder.success"),
        detail: t("coverageBuilder.saved"),
      });
      setShowDialog(false);
      loadCoverages();
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("coverageBuilder.error"),
        detail: t("coverageBuilder.failedToSave"),
      });
    }
  };

  const typeBodyTemplate = (rowData) => {
    const severity = rowData.type === "Mandatory" ? "danger" : "info";
    const label = rowData.type === "Mandatory" ? t("coverageBuilder.mandatory") : t("coverageBuilder.optional");
    return <Tag value={label} severity={severity} />;
  };

  return (
    <div className="coverage-builder p-3">
      <Toast ref={toast} />
      <Card title={t("coverageBuilder.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("coverageBuilder.pageTitle")}</h3>
          <Button
            label={t("coverageBuilder.addCoverage")}
            icon="pi pi-plus"
            onClick={() => {
              setSelectedCoverage({ limits: [], exclusions: [] });
              setShowDialog(true);
            }}
          />
        </div>

        <DataTable value={coverages} loading={loading} paginator rows={10}>
          <Column field="coverageCode" header={t("coverageBuilder.code")} sortable />
          <Column field="coverageName" header={t("coverageBuilder.coverageName")} sortable />
          <Column header={t("coverageBuilder.type")} body={typeBodyTemplate} sortable />
          <Column
            field="deductible"
            header={t("coverageBuilder.deductible")}
            sortable
            body={(rowData) => formatCurrency(rowData.deductible ?? 0)}
          />
          <Column field="premiumImpact" header={t("coverageBuilder.premiumImpact")} sortable />
          <Column
            header={t("coverageBuilder.actions")}
            body={(rowData) => (
              <div className="flex gap-2">
                <Button icon="pi pi-pencil" className="p-button-text" />
                <Button icon="pi pi-copy" className="p-button-text" />
                <Button
                  icon="pi pi-trash"
                  className="p-button-text p-button-danger"
                />
              </div>
            )}
          />
        </DataTable>
      </Card>

      <Dialog
        header={t("coverageBuilder.configureCoverage")}
        visible={showDialog}
        style={{ width: "60vw" }}
        onHide={() => setShowDialog(false)}
      >
        <div className="p-fluid">
          <div className="grid">
            <div className="col-6">
              <div className="field">
                <label>{t("coverageBuilder.coverageCode")}</label>
                <InputText
                  value={selectedCoverage?.coverageCode}
                  onChange={(e) =>
                    setSelectedCoverage({
                      ...selectedCoverage,
                      coverageCode: e.target.value,
                    })
                  }
                />
              </div>
              <div className="field">
                <label>{t("coverageBuilder.coverageName")}</label>
                <InputText
                  value={selectedCoverage?.coverageName}
                  onChange={(e) =>
                    setSelectedCoverage({
                      ...selectedCoverage,
                      coverageName: e.target.value,
                    })
                  }
                />
              </div>
              <div className="field">
                <label>{t("coverageBuilder.type")}</label>
                <Dropdown
                  value={selectedCoverage?.type}
                  options={typeOptions}
                  optionLabel="label"
                  optionValue="value"
                  onChange={(e) =>
                    setSelectedCoverage({ ...selectedCoverage, type: e.value })
                  }
                />
              </div>
            </div>
            <div className="col-6">
              <div className="field">
                <label>{t("coverageBuilder.deductibleAmount")}</label>
                <InputNumber
                  value={selectedCoverage?.deductible}
                  mode="currency"
                  currency={currencyCode}
                  onChange={(e) =>
                    setSelectedCoverage({
                      ...selectedCoverage,
                      deductible: e.value,
                    })
                  }
                />
              </div>
              <div className="field">
                <label>{t("coverageBuilder.waitingPeriodDays")}</label>
                <InputNumber
                  value={selectedCoverage?.waitingPeriod}
                  onChange={(e) =>
                    setSelectedCoverage({
                      ...selectedCoverage,
                      waitingPeriod: e.value,
                    })
                  }
                />
              </div>
              <div className="field">
                <label>{t("coverageBuilder.premiumImpact")}</label>
                <InputText
                  value={selectedCoverage?.premiumImpact}
                  onChange={(e) =>
                    setSelectedCoverage({
                      ...selectedCoverage,
                      premiumImpact: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <div className="field">
            <label>{t("coverageBuilder.description")}</label>
            <InputTextarea
              value={selectedCoverage?.description}
              rows={3}
              onChange={(e) =>
                setSelectedCoverage({
                  ...selectedCoverage,
                  description: e.target.value,
                })
              }
            />
          </div>
          <div className="field">
            <label>{t("coverageBuilder.exclusions")}</label>
            <Chips
              value={selectedCoverage?.exclusions}
              onChange={(e) =>
                setSelectedCoverage({
                  ...selectedCoverage,
                  exclusions: e.value,
                })
              }
            />
          </div>
          <Button
            label={t("coverageBuilder.saveCoverage")}
            icon="pi pi-check"
            onClick={saveCoverage}
          />
        </div>
      </Dialog>
    </div>
  );
};

// PC-4: Rating Engine
export const RatingEngine = () => {
  const { t } = useTranslation();
  const [ratingFactors, setRatingFactors] = useState([]);
  const [selectedFactor, setSelectedFactor] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useRef(null);

  const typeOptions = [
    { label: t("ratingEngine.multiplicative"), value: "Multiplicative" },
    { label: t("ratingEngine.additive"), value: "Additive" },
    { label: t("ratingEngine.discount"), value: "Discount" },
  ];

  useEffect(() => {
    loadRatingFactors();
  }, []);

  const loadRatingFactors = async () => {
    setLoading(true);
    try {
      const data = await productConfiguratorMockService.getRatingFactors();
      setRatingFactors(data);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("ratingEngine.error"),
        detail: t("ratingEngine.failedToLoad"),
      });
    } finally {
      setLoading(false);
    }
  };

  const saveFactor = async () => {
    try {
      await productConfiguratorMockService.createRatingFactor(selectedFactor);
      toast.current?.show({
        severity: "success",
        summary: t("ratingEngine.success"),
        detail: t("ratingEngine.saved"),
      });
      setShowDialog(false);
      loadRatingFactors();
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("ratingEngine.error"),
        detail: t("ratingEngine.failedToSave"),
      });
    }
  };

  const expandedRowTemplate = (data) => {
    return (
      <div className="p-3">
        <h5>{t("ratingEngine.ratingRules")}</h5>
        <DataTable value={data.rules}>
          <Column field="condition" header={t("ratingEngine.condition")} />
          <Column field="factor" header={t("ratingEngine.factor")} />
          <Column field="description" header={t("ratingEngine.description")} />
        </DataTable>
      </div>
    );
  };

  return (
    <div className="rating-engine p-3">
      <Toast ref={toast} />
      <Card title={t("ratingEngine.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("ratingEngine.pageTitle")}</h3>
          <div className="flex gap-2">
            <Button
              label={t("ratingEngine.testCalculator")}
              icon="pi pi-calculator"
              className="p-button-secondary"
            />
            <Button
              label={t("ratingEngine.addFactor")}
              icon="pi pi-plus"
              onClick={() => {
                setSelectedFactor({ rules: [] });
                setShowDialog(true);
              }}
            />
          </div>
        </div>

        <DataTable
          value={ratingFactors}
          loading={loading}
          paginator
          rows={10}
          expandedRows={[]}
          rowExpansionTemplate={expandedRowTemplate}
        >
          <Column expander style={{ width: "3em" }} />
          <Column field="factorCode" header={t("ratingEngine.factorCode")} sortable />
          <Column field="factorName" header={t("ratingEngine.factorName")} sortable />
          <Column
            field="type"
            header={t("ratingEngine.type")}
            sortable
            body={(rowData) => <Tag value={rowData.type} />}
          />
          <Column
            field="status"
            header={t("ratingEngine.status")}
            sortable
            body={(rowData) => (
              <Tag
                value={rowData.status}
                severity={rowData.status === "Active" ? "success" : "warning"}
              />
            )}
          />
          <Column
            header={t("ratingEngine.rulesCount")}
            body={(rowData) => rowData.rules?.length || 0}
          />
          <Column
            header={t("ratingEngine.actions")}
            body={(rowData) => (
              <div className="flex gap-2">
                <Button icon="pi pi-pencil" className="p-button-text" />
                <Button icon="pi pi-copy" className="p-button-text" />
              </div>
            )}
          />
        </DataTable>
      </Card>

      <Dialog
        header={t("ratingEngine.configureFactor")}
        visible={showDialog}
        style={{ width: "50vw" }}
        onHide={() => setShowDialog(false)}
      >
        <div className="p-fluid">
          <div className="field">
            <label>{t("ratingEngine.factorCode")}</label>
            <InputText
              value={selectedFactor?.factorCode}
              onChange={(e) =>
                setSelectedFactor({
                  ...selectedFactor,
                  factorCode: e.target.value,
                })
              }
            />
          </div>
          <div className="field">
            <label>{t("ratingEngine.factorName")}</label>
            <InputText
              value={selectedFactor?.factorName}
              onChange={(e) =>
                setSelectedFactor({
                  ...selectedFactor,
                  factorName: e.target.value,
                })
              }
            />
          </div>
          <div className="field">
            <label>{t("ratingEngine.type")}</label>
            <Dropdown
              value={selectedFactor?.type}
              options={typeOptions}
              optionLabel="label"
              optionValue="value"
              onChange={(e) =>
                setSelectedFactor({ ...selectedFactor, type: e.value })
              }
            />
          </div>
          <Button label={t("ratingEngine.saveFactor")} icon="pi pi-check" onClick={saveFactor} />
        </div>
      </Dialog>
    </div>
  );
};

// PC-5: Underwriting Rules
export const UnderwritingRules = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [selectedRule, setSelectedRule] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useRef(null);

  const typeOptions = [
    { label: t("underwritingRules.acceptance"), value: "Acceptance" },
    { label: t("underwritingRules.validation"), value: "Validation" },
    { label: t("underwritingRules.loading"), value: "Loading" },
  ];
  const actionOptions = [
    { label: t("underwritingRules.autoAccept"), value: "Auto-Accept" },
    { label: t("underwritingRules.refer"), value: "Refer" },
    { label: t("underwritingRules.decline"), value: "Decline" },
    { label: t("underwritingRules.applyLoading"), value: "Apply Loading" },
  ];

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await productConfiguratorMockService.getUnderwritingRules();
      setRules(data);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("underwritingRules.error"),
        detail: t("underwritingRules.failedToLoad"),
      });
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async () => {
    try {
      await productConfiguratorMockService.createUnderwritingRule(selectedRule);
      toast.current?.show({
        severity: "success",
        summary: t("underwritingRules.success"),
        detail: t("underwritingRules.saved"),
      });
      setShowDialog(false);
      loadRules();
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("underwritingRules.error"),
        detail: t("underwritingRules.failedToSave"),
      });
    }
  };

  const actionBodyTemplate = (rowData) => {
    const severity =
      rowData.action === "Auto-Accept"
        ? "success"
        : rowData.action === "Refer"
        ? "warning"
        : "danger";
    const actionLabel = actionOptions.find((o) => o.value === rowData.action)?.label ?? rowData.action;
    return <Tag value={actionLabel} severity={severity} />;
  };

  return (
    <div className="underwriting-rules p-3">
      <Toast ref={toast} />
      <Card title={t("underwritingRules.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("underwritingRules.pageTitle")}</h3>
          <Button
            label={t("underwritingRules.addRule")}
            icon="pi pi-plus"
            onClick={() => {
              setSelectedRule({});
              setShowDialog(true);
            }}
          />
        </div>

        <Accordion multiple>
          <AccordionTab
            header={t("underwritingRules.acceptanceRules", {
              count: rules.filter((r) => r.type === "Acceptance").length,
            })}
          >
            <DataTable
              value={rules.filter((r) => r.type === "Acceptance")}
              loading={loading}
            >
              <Column field="ruleCode" header={t("underwritingRules.ruleCode")} sortable />
              <Column field="ruleName" header={t("underwritingRules.ruleName")} sortable />
              <Column field="condition" header={t("ratingEngine.condition")} />
              <Column header={t("underwritingRules.action")} body={actionBodyTemplate} />
              <Column field="authority" header={t("underwritingRules.authorityLevel")} />
              <Column
                field="status"
                header={t("ratingEngine.status")}
                body={(rowData) => (
                  <Tag
                    value={rowData.status}
                    severity={
                      rowData.status === "Active" ? "success" : "warning"
                    }
                  />
                )}
              />
            </DataTable>
          </AccordionTab>
          <AccordionTab
            header={t("underwritingRules.validationRules", {
              count: rules.filter((r) => r.type === "Validation").length,
            })}
          >
            <DataTable
              value={rules.filter((r) => r.type === "Validation")}
              loading={loading}
            >
              <Column field="ruleCode" header={t("underwritingRules.ruleCode")} sortable />
              <Column field="ruleName" header={t("underwritingRules.ruleName")} sortable />
              <Column field="condition" header={t("ratingEngine.condition")} />
              <Column header={t("underwritingRules.action")} body={actionBodyTemplate} />
              <Column field="authority" header={t("underwritingRules.authorityLevel")} />
            </DataTable>
          </AccordionTab>
          <AccordionTab
            header={t("underwritingRules.loadingRules", {
              count: rules.filter((r) => r.type === "Loading").length,
            })}
          >
            <DataTable
              value={rules.filter((r) => r.type === "Loading")}
              loading={loading}
            >
              <Column field="ruleCode" header={t("underwritingRules.ruleCode")} sortable />
              <Column field="ruleName" header={t("underwritingRules.ruleName")} sortable />
              <Column field="condition" header={t("ratingEngine.condition")} />
              <Column field="message" header={t("underwritingRules.loadingDescription")} />
              <Column field="authority" header={t("underwritingRules.authorityLevel")} />
            </DataTable>
          </AccordionTab>
        </Accordion>
      </Card>

      <Dialog
        header={t("underwritingRules.configureRule")}
        visible={showDialog}
        style={{ width: "50vw" }}
        onHide={() => setShowDialog(false)}
      >
        <div className="p-fluid">
          <div className="field">
            <label>{t("underwritingRules.ruleCode")}</label>
            <InputText
              value={selectedRule?.ruleCode}
              onChange={(e) =>
                setSelectedRule({ ...selectedRule, ruleCode: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label>{t("underwritingRules.ruleName")}</label>
            <InputText
              value={selectedRule?.ruleName}
              onChange={(e) =>
                setSelectedRule({ ...selectedRule, ruleName: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label>{t("underwritingRules.type")}</label>
            <Dropdown
              value={selectedRule?.type}
              options={typeOptions}
              optionLabel="label"
              optionValue="value"
              onChange={(e) =>
                setSelectedRule({ ...selectedRule, type: e.value })
              }
            />
          </div>
          <div className="field">
            <label>{t("ratingEngine.condition")}</label>
            <InputTextarea
              value={selectedRule?.condition}
              rows={3}
              onChange={(e) =>
                setSelectedRule({ ...selectedRule, condition: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label>{t("underwritingRules.action")}</label>
            <Dropdown
              value={selectedRule?.action}
              options={actionOptions}
              optionLabel="label"
              optionValue="value"
              onChange={(e) =>
                setSelectedRule({ ...selectedRule, action: e.value })
              }
            />
          </div>
          <Button label={t("underwritingRules.saveRule")} icon="pi pi-check" onClick={saveRule} />
        </div>
      </Dialog>
    </div>
  );
};

// PC-6: Approval Workflows
export const ApprovalWorkflows = () => {
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useRef(null);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const data = await productConfiguratorMockService.getApprovalWorkflows();
      setWorkflows(data);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("approvalWorkflows.error"),
        detail: t("approvalWorkflows.failedToLoad"),
      });
    } finally {
      setLoading(false);
    }
  };

  const workflowTemplate = (workflow) => {
    const events = workflow.stages.map((stage) => ({
      status: stage.role,
      date: `SLA: ${stage.sla}`,
      icon: "pi pi-user",
      color: "#9C27B0",
    }));

    return (
      <Timeline
        value={events}
        align="left"
        className="customized-timeline"
        marker={(item) => (
          <span
            className="flex align-items-center justify-content-center"
            style={{
              backgroundColor: item.color,
              color: "white",
              borderRadius: "50%",
              width: "2rem",
              height: "2rem",
            }}
          >
            <i className={item.icon}></i>
          </span>
        )}
        content={(item) => (
          <Card>
            <h5>{item.status}</h5>
            <p>{item.date}</p>
          </Card>
        )}
      />
    );
  };

  return (
    <div className="approval-workflows p-3">
      <Toast ref={toast} />
      <Card title={t("approvalWorkflows.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("approvalWorkflows.pageTitle")}</h3>
          <Button label={t("approvalWorkflows.createWorkflow")} icon="pi pi-plus" />
        </div>

        {workflows.map((workflow) => (
          <Panel
            key={workflow.id}
            header={workflow.workflowName}
            toggleable
            className="mb-3"
          >
            <div className="grid">
              <div className="col-8">{workflowTemplate(workflow)}</div>
              <div className="col-4">
                <Card title={t("approvalWorkflows.workflowDetails")}>
                  <div className="field">
                    <label>{t("approvalWorkflows.code")}:</label>
                    <p>{workflow.workflowCode}</p>
                  </div>
                  <div className="field">
                    <label>{t("approvalWorkflows.type")}:</label>
                    <p>
                      <Tag value={workflow.type} />
                    </p>
                  </div>
                  <div className="field">
                    <label>{t("approvalWorkflows.status")}:</label>
                    <p>
                      <Tag value={workflow.status} severity="success" />
                    </p>
                  </div>
                  <div className="field">
                    <label>{t("approvalWorkflows.triggers")}:</label>
                    {workflow.triggers.map((trigger) => (
                      <Tag
                        key={trigger}
                        value={trigger}
                        className="mr-2 mb-2"
                      />
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </Panel>
        ))}
      </Card>
    </div>
  );
};

// PC-7: Market Mapping
export const MarketMapping = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useRef(null);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    setLoading(true);
    try {
      const data = await productConfiguratorMockService.getMarketMapping();
      setMappings(data);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("marketMapping.error"),
        detail: t("marketMapping.failedToLoad"),
      });
    } finally {
      setLoading(false);
    }
  };

  const progressBodyTemplate = (rowData) => {
    const percentage = (rowData.ytdPremium / rowData.targetPremium) * 100;
    return (
      <div>
        <ProgressBar
          value={percentage}
          showValue={false}
          style={{ height: "20px" }}
        />
        <small>{percentage.toFixed(1)}% {t("marketMapping.ofTarget")}</small>
      </div>
    );
  };

  return (
    <div className="market-mapping p-3">
      <Toast ref={toast} />
      <Card title={t("marketMapping.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("marketMapping.pageTitle")}</h3>
          <Button label={t("marketMapping.mapProduct")} icon="pi pi-plus" />
        </div>

        <DataTable value={mappings} loading={loading} paginator rows={10}>
          <Column field="productId" header={t("marketMapping.product")} />
          <Column field="insurerName" header={t("marketMapping.insurer")} sortable />
          <Column field="productCode" header={t("marketMapping.insurerCode")} />
          <Column
            field="commissionRate"
            header={t("marketMapping.commissionPercent")}
            sortable
            body={(rowData) => `${rowData.commissionRate}%`}
          />
          <Column
            field="overrideRate"
            header={t("marketMapping.overridePercent")}
            sortable
            body={(rowData) => `${rowData.overrideRate}%`}
          />
          <Column
            field="targetPremium"
            header={t("marketMapping.target")}
            sortable
            body={(rowData) => formatCurrency(rowData.targetPremium)}
          />
          <Column header={t("marketMapping.ytdPerformance")} body={progressBodyTemplate} />
          <Column
            field="status"
            header={t("marketMapping.status")}
            body={(rowData) => (
              <Tag value={rowData.status} severity="success" />
            )}
          />
        </DataTable>
      </Card>
    </div>
  );
};

// PC-8: Document Manager
export const DocumentManager = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useRef(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await productConfiguratorMockService.getDocumentTemplates();
      setDocuments(data);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("documentManager.error"),
        detail: t("documentManager.failedToLoad"),
      });
    } finally {
      setLoading(false);
    }
  };

  const formatBodyTemplate = (rowData) => {
    const icon =
      rowData.format === "PDF"
        ? "pi pi-file-pdf"
        : rowData.format === "Excel"
        ? "pi pi-file-excel"
        : "pi pi-file";
    return <i className={icon} style={{ fontSize: "1.5rem" }}></i>;
  };

  return (
    <div className="document-manager p-3">
      <Toast ref={toast} />
      <Card title={t("documentManager.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("documentManager.pageTitle")}</h3>
          <Button label={t("documentManager.uploadTemplate")} icon="pi pi-upload" />
        </div>

        <DataTable value={documents} loading={loading} paginator rows={10}>
          <Column header={t("documentManager.format")} body={formatBodyTemplate} />
          <Column field="documentCode" header={t("documentManager.documentCode")} sortable />
          <Column field="documentName" header={t("documentManager.documentName")} sortable />
          <Column field="type" header={t("documentManager.type")} sortable />
          <Column field="stage" header={t("documentManager.stage")} sortable />
          <Column
            field="mandatory"
            header={t("documentManager.required")}
            body={(rowData) =>
              rowData.mandatory ? (
                <i className="pi pi-check text-green-500"></i>
              ) : (
                <i className="pi pi-times text-red-500"></i>
              )
            }
          />
          <Column
            header={t("documentManager.actions")}
            body={(rowData) => (
              <div className="flex gap-2">
                <Button
                  icon="pi pi-download"
                  className="p-button-text"
                  tooltip={t("documentManager.download")}
                />
                <Button
                  icon="pi pi-pencil"
                  className="p-button-text"
                  tooltip={t("documentManager.edit")}
                />
                <Button
                  icon="pi pi-eye"
                  className="p-button-text"
                  tooltip={t("documentManager.preview")}
                />
              </div>
            )}
          />
        </DataTable>
      </Card>
    </div>
  );
};

// PC-9: Product Analytics
export const ProductAnalytics = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useRef(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await productConfiguratorMockService.getProductAnalytics();
      setAnalytics(data);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("productAnalytics.error"),
        detail: t("productAnalytics.failedToLoad"),
      });
    } finally {
      setLoading(false);
    }
  };

  const performanceChart = {
    labels: analytics?.performanceTrend?.map((tr) => tr.month) || [],
    datasets: [
      {
        label: t("productAnalytics.premiumPhpMillions"),
        data:
          analytics?.performanceTrend?.map((tr) => tr.premium / 1000000) || [],
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgb(54, 162, 235)",
        tension: 0.4,
      },
    ],
  };

  const categoryChart = {
    labels: Object.keys(analytics?.categoryBreakdown || {}),
    datasets: [
      {
        data: Object.values(analytics?.categoryBreakdown || {}).map(
          (c) => c.premium / 1000000
        ),
        backgroundColor: [
          "#FF6384",
          "#36A2EB",
          "#FFCE56",
          "#4BC0C0",
          "#9966FF",
        ],
      },
    ],
  };

  return (
    <div className="product-analytics p-3">
      <Toast ref={toast} />
      <Card title={t("productAnalytics.cardTitle")}>
        <div className="grid">
          <div className="col-8">
            <Card title={t("productAnalytics.premiumTrend")}>
              <Chart type="line" data={performanceChart} />
            </Card>
          </div>
          <div className="col-4">
            <Card title={t("productAnalytics.categoryDistribution")}>
              <Chart type="pie" data={categoryChart} />
            </Card>
          </div>
        </div>

        <Card title={t("productAnalytics.topProductsPerformance")} className="mt-3">
          <DataTable value={analytics?.topProducts || []}>
            <Column field="productName" header={t("productAnalytics.product")} />
            <Column
              field="totalPolicies"
              header={t("productAnalytics.policies")}
              sortable
              body={(rowData) => rowData.totalPolicies.toLocaleString()}
            />
            <Column
              field="totalPremium"
              header={t("productAnalytics.premium")}
              sortable
              body={(rowData) => formatCurrency(rowData.totalPremium)}
            />
            <Column
              field="avgPremium"
              header={t("productAnalytics.avgPremium")}
              sortable
              body={(rowData) => formatCurrency(rowData.avgPremium)}
            />
            <Column
              field="lossRatio"
              header={t("productAnalytics.lossRatio")}
              sortable
              body={(rowData) => (
                <div>
                  <ProgressBar value={rowData.lossRatio} showValue={false} />
                  <small>{rowData.lossRatio}%</small>
                </div>
              )}
            />
            <Column
              field="profitMargin"
              header={t("productAnalytics.profitMargin")}
              sortable
              body={(rowData) => (
                <Tag value={`${rowData.profitMargin}%`} severity="success" />
              )}
            />
          </DataTable>
        </Card>
      </Card>
    </div>
  );
};
