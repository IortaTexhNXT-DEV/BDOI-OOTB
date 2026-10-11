/**
 * The decisions on a remittance approval, shared by the Approvals review panel and the remittance record page: the
 * texts of "Can I decide?" and of the authority chips, Approve (a confirmation with the R1 text: settlement and payment
 * follow in Disbursement) and Reject (a ConfirmDialog with a reason of the remittance_reject context). Both send the version shown;
 * a 409 (decided by someone else meanwhile, or changed) is not an error of the dialog: it closes and the screen shows
 * the server's sentence ("Approved by J. Cruz at 10:32.") and reloads.
 */
import React, { useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import ConfirmDialog, { openConfirm } from "../../../components/ConfirmDialog";
import { remittanceService } from "../../../services/remittanceService";
import { formatDate, money } from "../shared";

/** The short reason of the "Can I decide?" column: "Above your limit (PHP 1,000,000.00)", "You submitted it". */
export const shortReason = (decision, t) => {
  const d = decision || {};
  switch (d.blockedCode) {
    case "ABOVE_LIMIT":
      return t("remittance.inbox.short.ABOVE_LIMIT", { limit: money(d.myLimit) });
    case "SUBMITTER":
    case "MAKER":
    case "EARLIER_LEVEL":
    case "NO_AUTHORITY":
    case "NO_PERMISSION":
    case "DELEGATED_AWAY":
    case "ALREADY_DECIDED":
      return t(`remittance.inbox.short.${d.blockedCode}`);
    default:
      return d.blockedReason || "";
  }
};

/** "Yes", or "No · <short reason>". */
export const canDecideText = (decision, t) => (decision?.canDecide ? t("remittance.inbox.yes") : t("remittance.inbox.no", { reason: shortReason(decision, t) }));

/**
 * The chips of the user's authority: "Remittance up to PHP 1,000,000.00" (or "no limit"), "Covering for A. Santos until
 * 16/10/2026", "No approval authority for remittances", or "View only" without approve:remittance.
 */
export const authorityChips = (authority, t) => {
  if (!authority) return [];
  if (!authority.permission) return [{ key: "view-only", label: t("remittance.common.viewOnly") }];
  if (!authority.canDecide) return [{ key: "none", label: t("remittance.inbox.authority.none") }];
  const own = authority.unlimited || authority.limit === null
    ? t("remittance.inbox.authority.unlimited") : t("remittance.inbox.authority.upTo", { amount: money(authority.limit) });
  return [{ key: "limit", label: own },
    ...(authority.covering || []).map((c) => ({ key: `covering-${c.name}`, label: t("remittance.inbox.authority.covering", { name: c.name, date: formatDate(c.until) }) }))];
};

/** A 409 of a decision: the approval was decided or changed meanwhile. */
export const isRace = (e) => e?.status === 409;

/**
 * Approve one remittance approval: confirmation, then POST /approvals/:id/approve with the version shown. Resolves
 * { done: true } once approved, { race: message } when someone else was faster or it changed, { done: false } when
 * cancelled.
 */
export const approveRemittance = async (t, { id, version, reference, amount }) => {
  let race = null;
  const done = await openConfirm({
    title: t("remittance.decision.approveTitle"),
    message: t("remittance.decision.approveMessage", { reference, amount: money(amount) }),
    confirmLabel: t("remittance.decision.approveVerb"),
    onConfirm: async () => {
      try {
        await remittanceService.approveApproval(id, { version });
      } catch (e) {
        if (!isRace(e)) throw e;
        race = e.message;
      }
    },
  });
  if (race) return { race };
  return { done };
};

/** Reject and return to maker: the reason of the remittance_reject context is required (MSG-RMT-012). */
export const RejectDialog = ({ approval, onHide }) => {
  const { t } = useTranslation();
  const a = approval || {};
  const race = useRef(null);
  const reject = async (reason) => {
    race.current = null;
    try {
      await remittanceService.rejectApproval(a.id, reason, a.version);
    } catch (e) {
      if (!isRace(e)) throw e;
      race.current = e.message;
    }
  };
  return (
    <ConfirmDialog visible={!!approval} reason={{ context: "remittance_reject", label: t("remittance.decision.reason") }} severity="danger" title={t("remittance.decision.rejectTitle", { reference: a.reference || "" })}
      facts={[{ label: t("remittance.decision.reference"), value: a.reference }, { label: t("remittance.decision.amount"), value: money(a.amount) }]}
      note={t("remittance.decision.rejectNote", { reference: a.reference || "", amount: money(a.amount), maker: a.makerName || t("remittance.decision.theMaker") })}
      confirmLabel={t("remittance.decision.rejectVerb")} onConfirm={reject}
      onHide={({ confirmed }) => onHide(race.current ? { race: race.current } : { done: !!confirmed })} />
  );
};

RejectDialog.propTypes = {
  /** the approval to reject: { id, version, reference, amount, makerName }; null hides the dialog */
  approval: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    version: PropTypes.number,
    reference: PropTypes.string,
    amount: PropTypes.number,
    makerName: PropTypes.string,
  }),
  /** { done } after the rejection or the cancel, { race: message } when it was decided meanwhile */
  onHide: PropTypes.func.isRequired,
};

RejectDialog.defaultProps = { approval: null };
