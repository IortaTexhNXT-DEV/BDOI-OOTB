import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import IntegrationsMonitor from "./IntegrationsMonitor";
import MessageTemplates from "./MessageTemplates";
import InsurerIntegration from "./InsurerIntegration";
import CtplAuthentication from "./CtplAuthentication";
import BankFileLayouts from "./BankFileLayouts";
import BankPaymentFiles from "./BankPaymentFiles";

jest.mock("../../services/integrationsService", () => ({
  __esModule: true,
  default: {
    connectors: () => Promise.resolve([{ code: "SMS_SEMAPHORE", name: "SMS gateway (Semaphore-style)", kind: "sms", adapter: "http_sms", adapterLabel: "HTTP SMS API",
      enabled: true, mode: "test", credentials: [{ key: "apiKey", envName: "SEMAPHORE_API_KEY", present: false }], liveBlockers: ["environment variable SEMAPHORE_API_KEY (apiKey) is not set"],
      queued: 1, failed: 0, sentToday: 3 }]),
    registry: () => Promise.resolve({ adapters: [], messageTypes: [] }),
    outbox: () => Promise.resolve({ rows: [], total: 0, counts: {} }),
    inbox: () => Promise.resolve({ rows: [], total: 0, counts: {} }),
    templates: () => Promise.resolve({ data: [{ code: "RENEWAL_NOTICE", name: "Renewal notice", channel: "sms", event: "renewal_notice", body: "Hi {{clientName}}", consentPurpose: "processing", active: true }], placeholders: {} }),
    mappings: () => Promise.resolve({ data: [], defaultRequestMap: {} }),
    insurerRequests: () => Promise.resolve({ rows: [], total: 0, counts: {} }),
    ctplList: () => Promise.resolve({ rows: [], total: 0, counts: { pending: 2, authenticated: 5 } }),
    cocSeries: () => Promise.resolve([]),
    layouts: () => Promise.resolve({ data: [{ code: "BDO-BULK", name: "BDO - bulk credit (example)", bankCode: "BDO", channels: ["bulk_credit"], format: "delimited", isExample: true, active: true }], sources: [], channels: [] }),
    payeeAccounts: () => Promise.resolve([]),
    batches: () => Promise.resolve({ rows: [], total: 0, counts: {} }),
  },
}));
jest.mock("../Remittance/shared", () => ({
  loadInsurerOptions: () => Promise.resolve([]),
  loadMasterOptions: () => Promise.resolve([]),
}));

const show = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("integration screens", () => {
  it("the monitor lists the connectors with their credential variable and what blocks live use", async () => {
    show(<IntegrationsMonitor />);
    expect(await screen.findByText("SMS gateway (Semaphore-style)")).toBeInTheDocument();
    expect(screen.getByText("SEMAPHORE_API_KEY")).toBeInTheDocument();
    expect(screen.getByText(/environment variable SEMAPHORE_API_KEY/)).toBeInTheDocument();
  });
  it("the message templates list the delivered templates", async () => {
    show(<MessageTemplates />);
    expect(await screen.findByText("RENEWAL_NOTICE")).toBeInTheDocument();
  });
  it("the CTPL screen counts the covers by status", async () => {
    show(<CtplAuthentication />);
    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Unauthenticated CTPL report/ })).toBeInTheDocument();
  });
  it("the bank file layouts mark the starter layouts", async () => {
    show(<BankFileLayouts />);
    expect(await screen.findByText("BDO-BULK")).toBeInTheDocument();
  });
  it("the insurer integration and bank payment files open", async () => {
    show(<InsurerIntegration />);
    expect(await screen.findByRole("button", { name: /New mapping/ })).toBeInTheDocument();
    show(<BankPaymentFiles />);
    expect(await screen.findByRole("button", { name: /New batch/ })).toBeInTheDocument();
  });
});

