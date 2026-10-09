/**
 * Centred pop-up for viewing a record, sized to its content (never the full-height side panel of the add and edit
 * forms): a header, the content, and the footer actions right-aligned, with Close when the screen gives no footer.
 *
 *   <DetailDialog visible={open} onHide={close} header={t("remittance.detailsTitle")} size="lg"
 *     footer={<><Button label={t("detailView.close")} text onClick={close} /><Button label={t("remittance.print")} onClick={print} /></>}>
 *     <DetailHeader ... />
 *     <DetailSection title={t("remittance.general")}><KeyValueGrid items={...} /></DetailSection>
 *     <DetailSection title={t("remittance.activity")}><ActivityLog entries={...} /></DetailSection>
 *   </DetailDialog>
 */
import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import "./detailDialog.scss";

const WIDTHS = { md: "44rem", lg: "64rem", xl: "80rem" };

const DetailDialog = ({ visible, onHide, header, size, footer, maximizable, className, children }) => {
  const { t } = useTranslation();
  const actions = footer === undefined ? <Button type="button" label={t("detailView.close")} outlined onClick={() => onHide()} /> : footer;
  return (
    <Dialog visible={visible} onHide={onHide} header={header} footer={actions} modal draggable={false} resizable={false} maximizable={maximizable}
      className={["bv-centered", "bv-detail-dialog", className].filter(Boolean).join(" ")} style={{ width: WIDTHS[size] || WIDTHS.lg }}
      breakpoints={{ "1100px": "94vw", "640px": "100vw" }}>
      <div className="bv-detail-dialog__body">{children}</div>
    </Dialog>
  );
};

DetailDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  header: PropTypes.node.isRequired,
  /** md 44rem, lg 64rem (default), xl 80rem; the full width on a small screen */
  size: PropTypes.oneOf(["md", "lg", "xl"]),
  /** footer actions, right-aligned; null for none; Close when not given */
  footer: PropTypes.node,
  maximizable: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

DetailDialog.defaultProps = { size: "lg", maximizable: false, className: null, children: null };

export default DetailDialog;
