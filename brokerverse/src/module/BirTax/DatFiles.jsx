import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";
import birTaxService from "../../services/birTaxService";
import { Kpis, PageHeader, QuarterPicker, YearPicker, currentQuarter, money, showError } from "./common";

const TYPES = ["qap", "sawt", "slspSales", "slspPurchases", "1604e"];

/**
 * Accounts > Tax > BIR DAT Files: the validation data files of the QAP (1601-EQ), the SAWT, the SLSP sales and
 * purchases (RELIEF) and the 1604-E alphalist, built from the same rows as the reports, with the layout version,
 * the record count, the totals and the warnings (for example a payee without TIN) before download.
 */
const DatFiles = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [type, setType] = useState("qap");
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(currentQuarter());
  const [form, setForm] = useState("");
  const [file, setFile] = useState(null);
  const [layout, setLayout] = useState(null);
  const annual = type === "1604e";
  const params = { year, quarter: annual ? undefined : quarter, form: type === "sawt" && form.length >= 4 ? form : undefined };

  useEffect(() => { birTaxService.datLayout().then(setLayout).catch((e) => showError(toast, e)); }, []);
  const load = useCallback(async () => {
    setFile(null);
    try {
      setFile(await birTaxService.datPreview(type, { year, quarter: annual ? undefined : quarter, form: type === "sawt" && form.length >= 4 ? form : undefined }));
    } catch (e) {
      showError(toast, e);
    }
  }, [type, year, quarter, form, annual]);
  useEffect(() => { load(); }, [load]);

  const download = async () => {
    try { await birTaxService.datDownload(type, params); } catch (e) { showError(toast, e); }
  };
  const totalKeys = Object.keys(file?.totals || {});
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("birTax.datFiles")} trail={[t("birTax.datFiles")]} subtitle={t("birTax.datFilesHelp")}>
        <Dropdown value={type} options={TYPES.map((x) => ({ label: t(`birTax.datType.${x}`), value: x }))} onChange={(e) => setType(e.value)} aria-label={t("birTax.fileType")} />
        <YearPicker value={year} onChange={setYear} />
        {!annual && <QuarterPicker value={quarter} onChange={setQuarter} />}
        {type === "sawt" && <InputText value={form} placeholder="1702Q" onChange={(e) => setForm(e.target.value.toUpperCase())} style={{ width: "7rem" }} aria-label={t("birTax.sawtForm")} />}
        <Button icon="pi pi-download" label={t("birTax.download")} onClick={download} disabled={!file} />
      </PageHeader>
      {layout && <Message severity="info" className="w-full mb-2" text={`${t("birTax.layoutVersion")}: ${layout.version}`} />}
      {file && (
        <>
          <Kpis items={[{ label: t("birTax.fileName"), value: file.fileName }, { label: t("birTax.records"), value: file.records }, { label: t("birTax.detailRows"), value: file.rows },
            ...totalKeys.map((k) => ({ label: t(`birTax.totals.${k}`, { defaultValue: k }), value: money(file.totals[k]) }))]} />
          {file.warnings.length > 0 && (
            <div className="pe-card">
              <h4>{t("birTax.warnings")}</h4>
              <ul>{file.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          <div className="pe-card">
            <h4>{t("birTax.recordLayout")}</h4>
            <ul className="pe-muted">{(file.layout?.records || []).map((r) => <li key={r}><code>{r}</code></li>)}</ul>
            <h4>{t("birTax.fileContent")}</h4>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", maxHeight: "24rem", overflow: "auto" }}>{file.content}</pre>
          </div>
        </>
      )}
    </div>
  );
};

export default DatFiles;
