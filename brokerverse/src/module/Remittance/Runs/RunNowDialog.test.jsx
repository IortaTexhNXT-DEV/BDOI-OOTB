import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import i18n from "../../../i18n";
import { remittanceService } from "../../../services/remittanceService";
import opsAccountingService from "../../../services/opsAccountingService";
import RunNowDialog, { runBlock } from "./RunNowDialog";

jest.mock("../../../services/remittanceService", () => ({ __esModule: true, remittanceService: { previewRun: jest.fn(), runSchedule: jest.fn() }, default: {} }));
jest.mock("../../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn().mockResolvedValue({ rows: [] }) } }));

const DONE = "This week's run is done (12/10/2026 06:15). Next run Mon 19/10/2026 06:15.";
const preview = (extra) => ({ schedule: { id: 7, code: "TIS-WEEKLY" }, runDate: "2026-10-12", paused: false, windowDone: { done: false },
  window: { text: "05/10/2026 – 09/10/2026" }, rows: [], totals: { insurers: 1, drafts: 2, ready: 3, held: 0, exceptions: 0, dueToInsurer: 100 }, ...extra });

describe("RunNowDialog", () => {
  it("says why a run cannot be made: paused, window already run, nothing to remit", () => {
    const t = i18n.t.bind(i18n);
    expect(runBlock(preview(), t)).toBeNull();
    expect(runBlock(preview({ paused: true }), t)).toBe("TIS-WEEKLY is paused. Resume it to run it.");
    expect(runBlock(preview({ windowDone: { done: true, message: DONE } }), t)).toBe(DONE);
    expect(runBlock(preview({ totals: { drafts: 0 } }), t)).toBe("Nothing to remit in this window.");
  });

  it("is disabled with the reason and the next run once the window has run", async () => {
    remittanceService.previewRun.mockResolvedValue(preview({ windowDone: { done: true, message: DONE } }));
    render(<MemoryRouter><RunNowDialog visible scheduleId={7} schedules={[{ id: 7, code: "TIS-WEEKLY", name: "Weekly remittance" }]} onHide={jest.fn()} /></MemoryRouter>);
    expect(await screen.findByText(DONE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create 2 draft remittances" })).toBeDisabled();
    expect(opsAccountingService.masterRecords).toHaveBeenCalledWith("reason-code", { status: "Active", context: "remittance_off_cycle" });
    expect(remittanceService.runSchedule).not.toHaveBeenCalled();
  });
});
