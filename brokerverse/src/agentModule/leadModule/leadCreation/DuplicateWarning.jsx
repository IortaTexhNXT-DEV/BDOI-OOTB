import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";

/**
 * Possible duplicates of the prospect about to be saved (GET /leads/duplicates): for a new customer the clients and open
 * prospects with the same e-mail, mobile number, or name and date of birth; for an existing client that client's open
 * prospects. The user links the prospect to a client found, opens a prospect found, or saves anyway.
 */
const DuplicateWarning = ({ matches, forClient = false, onUseClient, onOpenProspect, onSaveAnyway, onHide, saving = false }) => {
  const { t } = useTranslation();
  const matched = (m) => m.matchedOn.filter((k) => k !== "client").map((k) => t(`prospectDuplicates.matchedOn.${k}`)).join(", ");
  return (
    <Dialog header={t("prospectDuplicates.title")} visible={!!matches} onHide={onHide} style={{ width: "40rem" }} breakpoints={{ "640px": "95vw" }} className="prospect-duplicates"
      footer={(
        <div className="flex justify-content-end gap-2">
          <Button type="button" label={t("prospectDuplicates.back")} text onClick={onHide} />
          <Button type="button" label={t("prospectDuplicates.saveAnyway")} icon="pi pi-check" onClick={onSaveAnyway} loading={saving} />
        </div>
      )}>
      <p className="mt-0">{t(forClient ? "prospectDuplicates.clientIntro" : "prospectDuplicates.intro")}</p>
      <ul className="prospect-duplicates__list">
        {(matches || []).map((m) => (
          <li key={`${m.kind}-${m.id}`} className="prospect-duplicates__item">
            <div className="prospect-duplicates__who">
              <strong>{m.name}</strong>
              <span className="prospect-duplicates__meta">
                {t(`prospectDuplicates.kind.${m.kind}`)} {m.number}
                {m.productName ? ` · ${m.productName}` : m.kind === "lead" && !m.lob ? ` · ${t("productPicker.untagged")}` : ""}
                {m.ownerName ? ` · ${t("prospectDuplicates.owner", { name: m.ownerName })}` : ""}
              </span>
              {matched(m) ? <span className="prospect-duplicates__meta">{t("prospectDuplicates.sameAs", { fields: matched(m) })}</span> : null}
            </div>
            {m.kind === "client" ? (
              <Button type="button" label={t("prospectDuplicates.useClient")} size="small" outlined onClick={() => onUseClient(m)} />
            ) : (
              <Button type="button" label={t("prospectDuplicates.openProspect")} size="small" outlined onClick={() => onOpenProspect(m)} />
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  );
};

DuplicateWarning.propTypes = {
  matches: PropTypes.arrayOf(PropTypes.object),
  forClient: PropTypes.bool,
  onUseClient: PropTypes.func.isRequired,
  onOpenProspect: PropTypes.func.isRequired,
  onSaveAnyway: PropTypes.func.isRequired,
  onHide: PropTypes.func.isRequired,
  saving: PropTypes.bool,
};

export default DuplicateWarning;
