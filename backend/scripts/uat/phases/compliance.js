/**
 * Customer due diligence (AML/CFT) on the clients the business created, as Operations records it on Operations >
 * Clients > Onboard client: the government ID of every retail client (the one checked at the quotation's KYC step), the
 * SEC registration, authorised signatory and beneficial owners of every corporate client. One corporate client is owned
 * by a politically exposed person: it is rated High and its EDD review, prepared by Operations with the evidence on
 * file, is approved by the compliance officer (maker-checker) before the client's next policy.
 */
import { dataOf, listOf } from '../http.js';
import { addDays } from '../dates.js';
import { person, pdf } from './common.js';

const ID_TYPES = ['PhilSys ID', "Driver's License", 'UMID', 'Passport'];
const idNumber = (rnd) => `${rnd.digits(4)}-${rnd.digits(4)}-${rnd.digits(4)}`;

/** The clients of a segment, once each, with the record of their first policy. */
function clientsOf(ctx, segment) {
  const seen = new Map();
  for (const p of ctx.policies) if (p.segment === segment && p.clientId && !seen.has(p.clientId)) seen.set(p.clientId, p);
  return [...seen.values()];
}

async function retailIdentification(ctx) {
  const { log, as, rnd } = ctx;
  const ops = as.operations;
  for (const p of clientsOf(ctx, 'retail')) {
    const client = ctx.clients.find((c) => c.leadId === p.leadId);
    const kyc = p.kyc || { idType: rnd.pick(ID_TYPES), idCardNumber: idNumber(rnd) };
    await log.step(`Government ID of ${client?.name || p.policyNumber} recorded (KYC)`, async () => {
      const r = dataOf(await ops.put(`/clients/${p.clientId}/kyc`, { idType: kyc.idType, idNumber: kyc.idCardNumber, idExpiry: addDays(ctx.today, rnd.int(200, 1500)),
        nationality: 'Filipino', occupation: rnd.pick(['Employee', 'Business owner', 'Professional', 'OFW', 'Retired']), sourceOfFunds: rnd.pick(['Salary', 'Business income', 'Remittances', 'Pension']) }));
      if (!r?.client) throw new Error('No client returned');
      log.count('Retail clients identified (government ID)');
    }, { who: ops.username });
  }
}

async function corporateDueDiligence(ctx) {
  const { log, as, rnd } = ctx;
  const ops = as.operations;
  const year = ctx.today.slice(0, 4);
  const corporates = clientsOf(ctx, 'corporate');
  ctx.state.pepClient = null;
  for (const [k, p] of corporates.entries()) {
    const client = ctx.clients.find((c) => c.leadId === p.leadId);
    const name = client?.name || p.policyNumber;
    await log.step(`Registration, signatory and beneficial owners of ${name} recorded (CDD)`, async () => {
      await ops.put(`/clients/${p.clientId}/kyc`, { clientType: 'corporate', registrationAuthority: 'SEC', registrationNumber: `CS${rnd.int(1995, 2022)}${rnd.digits(5)}`,
        registrationDate: `${rnd.int(1995, 2022)}-${String(rnd.int(1, 12)).padStart(2, '0')}-${String(rnd.int(1, 28)).padStart(2, '0')}`,
        businessNature: client?.prospect?.industry || 'Trading', incorporationCountry: 'Philippines', sourceOfFunds: 'Business income' });
      const signer = person(rnd);
      await ops.post(`/aml/clients/${p.clientId}/signatories`, { fullName: `${signer.firstName} ${signer.lastName}`, position: rnd.pick(['President', 'Treasurer', 'Finance Manager', 'Corporate Secretary']),
        nationality: 'Filipino', birthDate: signer.DOB, idType: rnd.pick(ID_TYPES), idNumber: idNumber(rnd), authorityDocument: 'secretary-certificate',
        authorityReference: `SC-${year}-${rnd.digits(3)}`, authorityDate: addDays(p.issueDate, -rnd.int(10, 60)), authorityValidUntil: `${Number(year) + 1}-12-31` });
      // the first corporate client is majority-owned by a politically exposed person: rated High, EDD review opened
      const owners = [person(rnd), person(rnd)];
      const pep = k === 0;
      for (const [i, o] of owners.entries()) {
        await ops.post(`/aml/clients/${p.clientId}/beneficial-owners`, { fullName: `${o.firstName} ${o.lastName}`, nationality: 'Filipino', birthDate: o.DOB, ownershipPercent: i === 0 ? 60 : 40,
          controlType: 'ownership', idType: rnd.pick(ID_TYPES), idNumber: idNumber(rnd), address: `${o.houseNo}, ${o.barangay}, ${o.city}`,
          ...(pep && i === 0 ? { isPep: true, pepDetails: 'Member of the provincial board (incumbent)' } : {}) });
      }
      const profile = dataOf(await ops.get(`/aml/clients/${p.clientId}/profile`));
      if ((profile.signatories || []).length < 1 || (profile.beneficialOwners || []).length < 2) throw new Error('The AML profile does not list the signatory and owners');
      if (pep) {
        if (profile.client?.riskRating !== 'high') throw new Error(`A PEP-owned client is rated ${profile.client?.riskRating}, expected high`);
        ctx.state.pepClient = { id: p.clientId, name };
      }
      log.count('Corporate clients with signatories and beneficial owners');
    }, { who: ops.username });
  }
}

async function eddReview(ctx) {
  const { log, as } = ctx;
  const ops = as.operations;
  const officer = as.compliance;
  const pep = ctx.state.pepClient;
  if (!pep) return;
  await log.step(`EDD review of ${pep.name} prepared by Operations and approved by the compliance officer`, async () => {
    let review = listOf(await ops.get('/aml/edd-reviews', { clientId: pep.id })).find((e) => !['approved', 'rejected'].includes(e.status)) || null;
    if (!review) review = dataOf(await officer.post('/aml/edd-reviews', { clientId: pep.id, reason: 'Beneficial owner is a politically exposed person' }));
    await ops.put(`/aml/edd-reviews/${review.id}`, { sourceOfWealth: 'Family trading business established 1998; audited financial statements on file', sourceOfFunds: 'Business income (operating cash flows)',
      purpose: 'Property and liability insurance of the business', findings: 'SEC registration, general information sheet and audited financial statements seen; the PEP owner holds an elected provincial office; no adverse media',
      seniorManagementApproval: true });
    await ops.upload('POST', `/aml/clients/${pep.id}/documents`, { docType: 'edd-evidence', relatedType: 'edd', relatedId: review.id, description: 'Audited financial statements' },
      [{ field: 'file', name: 'audited-fs.pdf', type: 'application/pdf', data: pdf('Audited financial statements') }]);
    await ops.post(`/aml/edd-reviews/${review.id}/submit`, {});
    const decided = dataOf(await officer.post(`/aml/edd-reviews/${review.id}/decide`, { decision: 'approve', notes: 'Source of wealth and funds documented; relationship approved by senior management' }));
    if (decided.status !== 'approved') throw new Error(`EDD review status ${decided.status}`);
    const profile = dataOf(await ops.get(`/aml/clients/${pep.id}/profile`));
    if (profile.client?.kycStatus !== 'complete') throw new Error(`KYC status after the EDD approval: ${profile.client?.kycStatus}`);
    log.count('EDD reviews approved');
  }, { who: `${ops.username}, ${officer.username}` });
}

export async function compliance(ctx) {
  ctx.log.setPhase('Compliance: customer due diligence');
  await retailIdentification(ctx);
  await corporateDueDiligence(ctx);
  await eddReview(ctx);
}
