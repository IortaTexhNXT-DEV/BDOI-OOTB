import { openConfirm } from "../../../components/ConfirmDialog";
import { remittanceService } from "../../../services/remittanceService";
import { money } from "../shared";

/**
 * Submit for approval of several drafts (the Remittances worklist and the result of an import): one confirmation
 * "Submit 3 remittances totalling PHP … for approval?" with the verb "Submit 3 remittances", then each draft is checked
 * on the server with the version it was shown. Resolves the server's answer ({ submitted, refused, results: [{ id,
 * reference, ok, code, message }] }), or null when the user cancelled.
 *
 * rows: [{ id, version, dueToInsurer }]
 */
export const submitDrafts = async (t, rows) => {
  const items = rows || [];
  if (!items.length) return null;
  const total = items.reduce((s, r) => s + Number(r.dueToInsurer || 0), 0);
  let out = null;
  const done = await openConfirm({
    title: t("remittance.list.submit.title"),
    message: t("remittance.list.submit.message", { count: items.length, amount: money(total) }),
    confirmLabel: t("remittance.list.submit.verb", { count: items.length }),
    onConfirm: async () => {
      out = await remittanceService.submitRemittances(items.map((r) => ({ id: r.id, version: r.version ?? undefined })));
    },
  });
  return done ? out : null;
};

export default submitDrafts;
