import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../i18n";
import TalkbotCalls from "./index";
import CallList from "./CallList";
import NewCallListDialog, { criteriaOf } from "./NewCallListDialog";
import { TalkbotCell } from "./TalkbotCell";
import talkbotService from "../../../services/talkbotService";
import distributionService from "../../../services/distributionService";
import { hasPermission } from "../../../utils/canOpen";

jest.mock("../../../services/talkbotService", () => ({
  __esModule: true,
  default: {
    lists: jest.fn(), list: jest.fn(), uploads: jest.fn(), options: jest.fn(), preview: jest.fn(), create: jest.fn(), download: jest.fn(),
    markSent: jest.fn(), cancel: jest.fn(), close: jest.fn(), createRenewalBatches: jest.fn(), attempts: jest.fn(), recordOutcome: jest.fn(),
    removeLine: jest.fn(), restoreLine: jest.fn(), templatePath: "/talkbot/results/template", resultsPath: (id) => `/talkbot/lists/${id}/results`,
  },
}));
jest.mock("../../../services/distributionService", () => ({ __esModule: true, default: { channelOptions: jest.fn() } }));
jest.mock("../../../utils/canOpen", () => ({ __esModule: true, canOpen: jest.fn(), hasPermission: jest.fn(), default: jest.fn() }));
jest.mock("../../../components/ActivityLog/RecordActivityLog", () => () => null);
jest.mock("../../../hooks/useFormatCurrency", () => ({ useFormatCurrency: () => ({ formatCurrency: (v) => `PHP ${Number(v || 0).toFixed(2)}`, currencyCode: "PHP" }) }));

const LIST = {
  id: "tcl_1", listNumber: "TCL-2026-00014", status: "draft", taskName: null, expiryFrom: "2026-10-10", expiryTo: "2026-10-10", accounts: 2, willing: 0, notCalled: 2,
  outcomeCounts: { "not-called": 2 }, callRecords: 0, downloads: 0, batchNumbers: [], leftOut: "6 accounts left out: 6 No mobile number", createdBy: "Ana Reyes",
  createdAt: "2026-10-07T01:00:00Z",
  lines: [{ id: 1, policyId: "pol_1", policyNumber: "POL-2025-41187", clientName: "ANDREA M. VILLANUEVA", mobile: "0917 *** 7105", vehicle: "2023 TOYOTA Raize",
    expiryDate: "2026-10-10", premium: 22610, calls: 0, outcome: "not-called", outcomeLabel: "Not called", lineStatus: "active" }],
};
const grant = (...codes) => hasPermission.mockImplementation((p) => codes.includes(p));
const atList = () => render(
  <MemoryRouter initialEntries={["/renewal/talkbot/tcl_1"]}>
    <Routes><Route path="/renewal/talkbot/:id" element={<CallList />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  talkbotService.lists.mockResolvedValue({ data: [{ ...LIST, status: "sent", taskName: "TIS_MV - OCT 07, 2026", batchNumbers: ["RB-2026-90014"] }], total: 1 });
  talkbotService.list.mockResolvedValue(LIST);
  talkbotService.uploads.mockResolvedValue([]);
  talkbotService.options.mockResolvedValue({ expiryFrom: "2026-10-12", expiryTo: "2026-10-14", taskName: "TIS_MV - OCT 09, 2026", insurers: [], salesPersons: [], recallLists: [] });
  talkbotService.preview.mockResolvedValue({ eligible: 41, leftOut: "4 accounts left out: 4 No mobile number" });
  distributionService.channelOptions.mockResolvedValue([]);
});

describe("Talkbot Calls", () => {
  it("lists the call lists with their task name, counts, batch and status", async () => {
    grant("read:talkbot-calls", "write:talkbot-calls");
    render(<MemoryRouter><TalkbotCalls /></MemoryRouter>);
    expect(await screen.findByText("TCL-2026-00014")).toBeInTheDocument();
    expect(screen.getByText("TIS_MV - OCT 07, 2026")).toBeInTheDocument();
    expect(screen.getByText("RB-2026-90014")).toBeInTheDocument();
    expect(screen.getByText("Sent to Talkbot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New call list/ })).toBeInTheDocument();
  });

  it("offers no maintenance to a user who only views the lists, and nothing without access", async () => {
    grant("read:talkbot-calls");
    const { unmount } = render(<MemoryRouter><TalkbotCalls /></MemoryRouter>);
    await screen.findByText("TCL-2026-00014");
    expect(screen.queryByRole("button", { name: /New call list/ })).toBeNull();
    unmount();
    grant();
    render(<MemoryRouter><TalkbotCalls /></MemoryRouter>);
    expect(screen.getByText("You do not have access to Talkbot call lists")).toBeInTheDocument();
    expect(talkbotService.lists).toHaveBeenCalledTimes(1);
  });
});

describe("New call list", () => {
  it("proposes the expiry dates of the day and counts the accounts that can be called", async () => {
    render(<NewCallListDialog visible onHide={jest.fn()} onCreated={jest.fn()} />);
    expect(await screen.findByText("41 accounts")).toBeInTheDocument();
    expect(screen.getByText("4 accounts left out: 4 No mobile number")).toBeInTheDocument();
    expect(talkbotService.preview).toHaveBeenCalledWith({ expiryFrom: "2026-10-12", expiryTo: "2026-10-14", includeExpired: false, includeCallBack: false });
    expect(screen.getByText("Motor Vehicle Insurance")).toBeInTheDocument();
  });
  it("sends only the criteria chosen", () => {
    expect(criteriaOf({ expiryFrom: "2026-10-10", insurerId: null, recallOf: "", includeExpired: true })).toEqual({ expiryFrom: "2026-10-10", includeExpired: true });
  });
});

describe("Call list", () => {
  it("offers Download and a disabled Mark as sent on a Draft list never downloaded; masks the mobile number", async () => {
    grant("read:talkbot-calls", "write:talkbot-calls");
    atList();
    expect(await screen.findByText("0917 *** 7105")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download call list/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Mark as sent/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Upload results/ })).toBeNull();
    expect(screen.getByText("6 accounts left out: 6 No mobile number")).toBeInTheDocument();
  });

  it("lets a viewer with write:renewals create the renewal batch only", async () => {
    grant("read:talkbot-calls", "write:renewals");
    talkbotService.list.mockResolvedValue({ ...LIST, status: "results-loaded", willing: 3, downloads: 1, outcomeCounts: { willing: 3 } });
    atList();
    expect(await screen.findByRole("button", { name: /Create renewal batch/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download call list/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Close list/ })).toBeNull();
  });

  it("filters the accounts by outcome from the summary figures", async () => {
    grant("read:talkbot-calls");
    atList();
    await screen.findByText("POL-2025-41187");
    fireEvent.click(screen.getAllByText("Not called")[0]);
    await waitFor(() => expect(talkbotService.list).toHaveBeenLastCalledWith("tcl_1", expect.objectContaining({ outcome: "not-called" })));
  });
});

describe("Talkbot outcome cell", () => {
  it("shows the outcome with its list and date, the callback date or the calls", () => {
    const { rerender } = render(<TalkbotCell talkbot={{ outcome: "willing", listNumber: "TCL-2026-00014", outcomeDate: "2026-10-07" }} />);
    expect(screen.getByText("Willing to renew")).toBeInTheDocument();
    expect(screen.getByText("TCL-2026-00014 · 07/10/2026")).toBeInTheDocument();
    rerender(<TalkbotCell talkbot={{ outcome: "call-back", callbackDate: "2026-10-12", manual: true }} />);
    expect(screen.getByText("Call back (Manual)")).toBeInTheDocument();
    expect(screen.getByText("Call back 12/10/2026")).toBeInTheDocument();
    rerender(<TalkbotCell talkbot={{ outcome: "missed-call", attempts: 4 }} />);
    expect(screen.getByText("4 calls")).toBeInTheDocument();
    rerender(<TalkbotCell talkbot={null} />);
    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
