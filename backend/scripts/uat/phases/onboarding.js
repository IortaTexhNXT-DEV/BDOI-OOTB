/**
 * Customer due diligence on the clients the business created, as Operations records it on Operations > Clients >
 * Onboard client: the government ID of every retail client (the one checked at the quotation's KYC step), the SEC
 * registration, authorised signatory, beneficial owners and the secretary's certificate of every corporate client.
 */
import { dataOf } from '../http.js';
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
  for (const p of clientsOf(ctx, 'corporate')) {
    const client = ctx.clients.find((c) => c.leadId === p.leadId);
    const name = client?.name || p.policyNumber;
    await log.step(`Registration, signatory and beneficial owners of ${name} recorded (CDD)`, async () => {
      await ops.put(`/clients/${p.clientId}/kyc`, { clientType: 'corporate', registrationAuthority: 'SEC', registrationNumber: `CS${rnd.int(1995, 2022)}${rnd.digits(5)}`,
        registrationDate: `${rnd.int(1995, 2022)}-${String(rnd.int(1, 12)).padStart(2, '0')}-${String(rnd.int(1, 28)).padStart(2, '0')}`,
        businessNature: client?.prospect?.industry || 'Trading', incorporationCountry: 'Philippines', sourceOfFunds: 'Business income' });
      const signer = person(rnd);
      await ops.post(`/clients/${p.clientId}/signatories`, { fullName: `${signer.firstName} ${signer.lastName}`, position: rnd.pick(['President', 'Treasurer', 'Finance Manager', 'Corporate Secretary']),
        nationality: 'Filipino', birthDate: signer.DOB, idType: rnd.pick(ID_TYPES), idNumber: idNumber(rnd), authorityDocument: 'secretary-certificate',
        authorityReference: `SC-${year}-${rnd.digits(3)}`, authorityDate: addDays(p.issueDate, -rnd.int(10, 60)), authorityValidUntil: `${Number(year) + 1}-12-31` });
      const owners = [person(rnd), person(rnd)];
      for (const [i, o] of owners.entries()) {
        await ops.post(`/clients/${p.clientId}/beneficial-owners`, { fullName: `${o.firstName} ${o.lastName}`, nationality: 'Filipino', birthDate: o.DOB, ownershipPercent: i === 0 ? 60 : 40,
          controlType: 'ownership', idType: rnd.pick(ID_TYPES), idNumber: idNumber(rnd), address: `${o.houseNo}, ${o.barangay}, ${o.city}` });
      }
      let profile = dataOf(await ops.get(`/clients/${p.clientId}/profile`));
      if ((profile.signatories || []).length < 1 || (profile.beneficialOwners || []).length < 2) throw new Error('The KYC profile does not list the signatory and owners');
      await ops.upload('POST', `/clients/${p.clientId}/documents`, { docType: 'secretary-certificate', relatedType: 'signatory', relatedId: profile.signatories[0].id, description: 'Secretary\'s certificate' },
        [{ field: 'file', name: 'secretary-certificate.pdf', type: 'application/pdf', data: pdf('Secretary\'s certificate') }]);
      profile = dataOf(await ops.get(`/clients/${p.clientId}/profile`));
      if (!(profile.documents || []).length) throw new Error('The secretary\'s certificate is not on file');
      log.count('Corporate clients with signatories and beneficial owners');
    }, { who: ops.username });
  }
}

export async function onboarding(ctx) {
  ctx.log.setPhase('Onboarding: customer due diligence');
  await retailIdentification(ctx);
  await corporateDueDiligence(ctx);
}
