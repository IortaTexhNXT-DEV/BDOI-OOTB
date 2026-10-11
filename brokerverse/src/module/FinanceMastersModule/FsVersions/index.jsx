import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import PageHeader from "../../../components/PageHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import LoadState from "../../../components/LoadState";
import StatusChip from "../../../components/StatusChip";
import FieldError from "../../../components/FieldError";
import periodEndService from "../../../services/periodEndService";
import { hasPermission } from "../../../utils/canOpen";
import { showErrorMessage, showSuccessMessage } from "../../../utility/toastUtils";
import { BALANCES, STATEMENTS, blankLine, lineErrors, linesPayload } from "./model";

let keySeq = 0;
const keyed = (l) => ({ ...l, _key: `k${(keySeq += 1)}` });

/**
 * Master > Finance > Financial Statement Versions: the versions of the statements (TIS01 local FS, TIS02 balance sheet
 * and income statement, TIS03 budget), each a list of lines with the range of GL accounts it carries. The FS reports
 * group the ledger by the lines of the version chosen. Finance (write:journal-vouchers) edits; others read.
 */
const FsVersions = () => {
  const { t } = useTranslation();
  const canWrite = hasPermission("write:journal-vouchers");
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [version, setVersion] = useState(null);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(null);

  const loadList = useCallback(async () => {
    try {
      const list = await periodEndService.fsVersions();
      setVersions(list);
      setSelected((cur) => cur || list[0]?.code || null);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!selected) return;
    periodEndService.fsVersion(selected).then((v) => {
      setVersion(v);
      setDraft({ name: v.name, purpose: v.purpose || "", status: v.status, lines: v.lines.map(keyed) });
      setErrors({});
    }).catch((e) => showErrorMessage(e.message));
  }, [selected]);

  const setLine = (i, patch) => setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const err = (i, f) => (errors[`${i}.${f}`] ? t(`fsVersions.errors.${errors[`${i}.${f}`]}`) : null);

  const save = async () => {
    const found = lineErrors(draft.lines, version.scope);
    setErrors(found);
    if (Object.keys(found).length || !draft.name.trim()) {
      showErrorMessage(t("fsVersions.fixErrors"));
      return;
    }
    setSaving(true);
    try {
      const v = await periodEndService.saveFsVersion(version.code, { name: draft.name.trim(), purpose: draft.purpose || null, status: draft.status, lines: linesPayload(draft.lines) });
      setVersion(v);
      setDraft({ name: v.name, purpose: v.purpose || "", status: v.status, lines: v.lines.map(keyed) });
      showSuccessMessage(t("fsVersions.saved", { code: v.code }));
      loadList();
    } catch (e) {
      showErrorMessage(e.message);
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    try {
      const v = await periodEndService.createFsVersion({ code: adding.code.trim().toUpperCase(), name: adding.name.trim(), purpose: adding.purpose || null, copyFrom: adding.copyFrom });
      setAdding(null);
      showSuccessMessage(t("fsVersions.added", { code: v.code }));
      await loadList();
      setSelected(v.code);
    } catch (e) {
      showErrorMessage(e.message);
    }
  };

  const statementOptions = STATEMENTS.map((s) => ({ value: s, label: t(`fsVersions.statements.${s}`) }));
  const balanceOptions = BALANCES.map((b) => ({ value: b, label: t(`fsVersions.balances.${b}`) }));
  const cell = (render, field) => (row, { rowIndex }) => (
    <div>
      {render(row, rowIndex)}
      <FieldError error={err(rowIndex, field)} />
    </div>
  );
  const readOnly = !canWrite;

  return (
    <div className="p-3">
      <PageHeader title={t("fsVersions.title")} home={t("sidebar.Master", "Master")} section={t("sidebar.Finance", "Finance")} help={t("fsVersions.help")}
        actions={canWrite ? <Button label={t("fsVersions.add")} icon="pi pi-plus" onClick={() => setAdding({ code: "", name: "", purpose: "", copyFrom: selected })} /> : null} />
      <LoadState loading={!versions && !error} error={error} onRetry={loadList}>
        <DataTable value={versions || []} dataKey="code" size="small" selectionMode="single" selection={(versions || []).find((v) => v.code === selected) || null}
          onSelectionChange={(e) => e.value && setSelected(e.value.code)} className="mb-3">
          <Column field="code" header={t("fsVersions.code")} />
          <Column field="name" header={t("fsVersions.name")} />
          <Column header={t("fsVersions.scope")} body={(v) => t(`fsVersions.scopes.${v.scope}`)} />
          <Column field="lineCount" header={t("fsVersions.lines")} className="text-right" headerClassName="text-right" />
          <Column header={t("fsVersions.status")} body={(v) => <StatusChip code={v.status} label={t(`fsVersions.statuses.${v.status}`)} />} />
        </DataTable>
        {version && draft ? (
          <>
            <DetailSection title={t("fsVersions.details", { code: version.code })}>
              {readOnly ? (
                <KeyValueGrid columns={3} items={[
                  { label: t("fsVersions.name"), value: version.name }, { label: t("fsVersions.purpose"), value: version.purpose },
                  { label: t("fsVersions.scope"), value: t(`fsVersions.scopes.${version.scope}`) },
                ]} />
              ) : (
                <div className="grid">
                  <div className="col-12 md:col-4">
                    <label className="bv-field-label" htmlFor="fsv-name">{t("fsVersions.name")}<span className="required-marker">*</span></label>
                    <InputText id="fsv-name" className="w-full" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </div>
                  <div className="col-12 md:col-5">
                    <label className="bv-field-label" htmlFor="fsv-purpose">{t("fsVersions.purpose")}</label>
                    <InputText id="fsv-purpose" className="w-full" value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} />
                  </div>
                  <div className="col-12 md:col-3">
                    <label className="bv-field-label" htmlFor="fsv-status">{t("fsVersions.status")}</label>
                    <Dropdown inputId="fsv-status" className="w-full" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.value })}
                      options={["active", "inactive"].map((s) => ({ value: s, label: t(`fsVersions.statuses.${s}`) }))} />
                  </div>
                </div>
              )}
            </DetailSection>
            <DetailSection title={t("fsVersions.lineSection")} className="mt-3" flush
              actions={canWrite ? (
                <>
                  <Button label={t("fsVersions.addLine")} icon="pi pi-plus" text size="small" onClick={() => setDraft({ ...draft, lines: [...draft.lines, keyed(blankLine(draft.lines, version.scope))] })} />
                  <Button label={t("fsVersions.save")} icon="pi pi-check" size="small" loading={saving} onClick={save} />
                </>
              ) : null}>
              <FieldError error={errors.lines ? t(`fsVersions.errors.${errors.lines}`) : null} />
              <DataTable value={draft.lines} dataKey="_key" size="small" scrollable>
                <Column header={t("fsVersions.lineNo")} style={{ width: "7rem" }} body={cell((l, i) => (readOnly ? l.lineNo : (
                  <InputNumber value={l.lineNo} onValueChange={(e) => setLine(i, { lineNo: e.value })} useGrouping={false} inputClassName="w-5rem" aria-label={t("fsVersions.lineNo")} />)), "lineNo")} />
                <Column header={t("fsVersions.statement")} body={cell((l, i) => (readOnly ? t(`fsVersions.statements.${l.statement}`) : (
                  <Dropdown value={l.statement} options={statementOptions} onChange={(e) => setLine(i, { statement: e.value })} aria-label={t("fsVersions.statement")} />)), "statement")} />
                <Column header={t("fsVersions.section")} body={cell((l, i) => (readOnly ? l.section : (
                  <InputText value={l.section} onChange={(e) => setLine(i, { section: e.target.value })} aria-label={t("fsVersions.section")} />)), "section")} />
                <Column header={t("fsVersions.caption")} body={cell((l, i) => (readOnly ? l.caption : (
                  <InputText value={l.caption} onChange={(e) => setLine(i, { caption: e.target.value })} aria-label={t("fsVersions.caption")} />)), "caption")} />
                <Column header={t("fsVersions.glFrom")} body={cell((l, i) => (readOnly ? l.glFrom : (
                  <InputText value={l.glFrom} className="w-7rem" onChange={(e) => setLine(i, { glFrom: e.target.value })} aria-label={t("fsVersions.glFrom")} />)), "glFrom")} />
                <Column header={t("fsVersions.glTo")} body={cell((l, i) => (readOnly ? l.glTo : (
                  <InputText value={l.glTo} className="w-7rem" onChange={(e) => setLine(i, { glTo: e.target.value })} aria-label={t("fsVersions.glTo")} />)), "glTo")} />
                <Column header={t("fsVersions.normalBalance")} body={(l, { rowIndex }) => (readOnly ? t(`fsVersions.balances.${l.normalBalance}`) : (
                  <Dropdown value={l.normalBalance} options={balanceOptions} onChange={(e) => setLine(rowIndex, { normalBalance: e.value })} aria-label={t("fsVersions.normalBalance")} />))} />
                <Column header={t("fsVersions.accounts")} className="text-right" headerClassName="text-right" body={(l) => (l.accounts === undefined ? "—" : l.accounts)} />
                {canWrite ? (
                  <Column style={{ width: "3rem" }} body={(l, { rowIndex }) => (
                    <Button icon="pi pi-trash" text rounded severity="danger" aria-label={t("fsVersions.removeLine", { line: l.lineNo })}
                      onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, j) => j !== rowIndex) })} />)} />
                ) : null}
              </DataTable>
            </DetailSection>
            <DetailSection title={t("fsVersions.unmapped", { count: version.unmapped.length })} className="mt-3" flush>
              <DataTable value={version.unmapped} dataKey="code" size="small" paginator rows={10} emptyMessage={t("fsVersions.allMapped")}>
                <Column field="code" header={t("fsVersions.accountCode")} />
                <Column field="name" header={t("fsVersions.accountName")} />
                <Column header={t("fsVersions.accountType")} body={(a) => t(`fsVersions.types.${a.accountType}`, { defaultValue: a.accountType })} />
              </DataTable>
            </DetailSection>
          </>
        ) : null}
      </LoadState>
      <Dialog header={t("fsVersions.add")} visible={!!adding} onHide={() => setAdding(null)} style={{ width: "36rem" }} breakpoints={{ "640px": "95vw" }}
        footer={(
          <div className="flex justify-content-end gap-2">
            <Button label={t("fsVersions.cancel")} text onClick={() => setAdding(null)} />
            <Button label={t("fsVersions.create")} icon="pi pi-check" disabled={!adding?.code?.trim() || !adding?.name?.trim() || !adding?.copyFrom} onClick={create} />
          </div>
        )}>
        {adding ? (
          <div className="grid">
            <div className="col-12 md:col-4">
              <label className="bv-field-label" htmlFor="fsv-new-code">{t("fsVersions.code")}<span className="required-marker">*</span></label>
              <InputText id="fsv-new-code" className="w-full" maxLength={20} value={adding.code} onChange={(e) => setAdding({ ...adding, code: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-12 md:col-8">
              <label className="bv-field-label" htmlFor="fsv-new-name">{t("fsVersions.name")}<span className="required-marker">*</span></label>
              <InputText id="fsv-new-name" className="w-full" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="bv-field-label" htmlFor="fsv-new-purpose">{t("fsVersions.purpose")}</label>
              <InputText id="fsv-new-purpose" className="w-full" value={adding.purpose} onChange={(e) => setAdding({ ...adding, purpose: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="bv-field-label" htmlFor="fsv-new-copy">{t("fsVersions.copyFrom")}<span className="required-marker">*</span></label>
              <Dropdown inputId="fsv-new-copy" className="w-full" value={adding.copyFrom}
                options={(versions || []).map((v) => ({ value: v.code, label: v.name }))} onChange={(e) => setAdding({ ...adding, copyFrom: e.value })} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default FsVersions;
