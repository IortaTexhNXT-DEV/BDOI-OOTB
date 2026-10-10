import { openConfirm } from "../../components/ConfirmDialog";

const nameOf = (lead) =>
  lead.fullName || [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.companyName || null;

/**
 * Asks to delete a prospect, naming it by number and name, and runs `remove` inside the dialog (a failure stays in the
 * dialog with its message). Used by the prospect list and the prospect detail. Resolves true once deleted.
 * @param {object} lead
 * @param {function(): Promise<void>} remove throws when the prospect could not be deleted
 * @param {function} t
 */
const confirmDeleteProspect = (lead, remove, t) =>
  openConfirm({
    title: t("leads.deleteTitle"),
    severity: "danger",
    message: t("leads.deleteMessage"),
    facts: [
      { label: t("leads.col.prospectId"), value: lead.generatedLeadId || lead.leadNumber || lead.leadId },
      { label: t("leads.col.name"), value: nameOf(lead) },
      { label: t("leads.col.productLine"), value: lead.productName || lead.productType || lead.lob, hidden: !lead.lob },
      { label: t("leads.col.quotations"), value: Number(lead.quotationsCount) || 0, type: "number" },
    ],
    note: t("leads.deleteNote"),
    confirmLabel: t("leads.deleteAction"),
    onConfirm: remove,
  });

export default confirmDeleteProspect;
