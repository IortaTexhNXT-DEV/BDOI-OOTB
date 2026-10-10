import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "../../../i18n";
import receiptsService from "../../../services/receiptsService";
import { openConfirm } from "../../../components/ConfirmDialog";
import ReceiptReversal from "./ReceiptReversal";

let mockPerms = [];
jest.mock("../../../utils/canOpen", () => ({ ...jest.requireActual("../../../utils/canOpen"), hasPermission: (p) => mockPerms.includes(p) }));
jest.mock("../../../utility/userIdentity", () => ({ currentUser: () => ({ userId: "usr_checker", username: "checker" }) }));
jest.mock("../../../services/receiptsService", () => ({ __esModule: true, default: { requestReversal: jest.fn(), decideReversal: jest.fn() } }));
jest.mock("../../../components/ConfirmDialog", () => ({ __esModule: true, openConfirm: jest.fn() }));
jest.mock("../../../utility/toastUtils", () => ({ showErrorMessage: jest.fn(), showSuccessMessage: jest.fn() }));

const pending = (requestedById) => ({ status: "pending", reason: "Cheque returned DAIF", requestedById, requestedBy: "Recon One", requestedAt: "2026-10-10T02:00:00Z" });
const show = (props) => render(<ReceiptReversal receiptId="rcpt_1" receiptNumber="OR-2026-00012" onChanged={jest.fn()} {...props} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms = [];
  receiptsService.requestReversal.mockResolvedValue({ message: "Reversal of receipt OR-2026-00012 sent for approval" });
  receiptsService.decideReversal.mockResolvedValue({ message: "Receipt OR-2026-00012 reversed" });
});

describe("Receipt reversal", () => {
  it("shows nothing to a user who cannot reverse a receipt without a reversal", () => {
    mockPerms = ["write:receipts"];
    const { container } = show({});
    expect(container).toBeEmptyDOMElement();
  });

  it("asks for the reversal with a reason code", async () => {
    mockPerms = ["reverse:receipts"];
    openConfirm.mockResolvedValue({ reasonCode: "RCT-REV-DAIF" });
    const onChanged = jest.fn();
    show({ onChanged });
    fireEvent.click(screen.getByRole("button", { name: "Reverse receipt" }));
    await waitFor(() => expect(receiptsService.requestReversal).toHaveBeenCalledWith("rcpt_1", { reasonCode: "RCT-REV-DAIF" }));
    expect(openConfirm.mock.calls[0][0].reason.context).toBe("receipt_reversal");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("the requester sees the decision buttons disabled with the reason", () => {
    mockPerms = ["reverse:receipts", "approve:receipt-reversal"];
    show({ reversal: pending("usr_checker") });
    expect(screen.getByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve reversal" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Reverse receipt" })).not.toBeInTheDocument();
  });

  it("another approver approves or returns with a reason", async () => {
    mockPerms = ["approve:receipt-reversal"];
    show({ reversal: pending("usr_recon") });
    openConfirm.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Approve reversal" }));
    await waitFor(() => expect(receiptsService.decideReversal).toHaveBeenCalledWith("rcpt_1", { action: "approve" }));
    openConfirm.mockResolvedValueOnce({ reasonCode: "RCT-REJ-NOPROOF" });
    fireEvent.click(screen.getByRole("button", { name: "Return" }));
    await waitFor(() => expect(receiptsService.decideReversal).toHaveBeenCalledWith("rcpt_1", { action: "return", reasonCode: "RCT-REJ-NOPROOF" }));
  });
});
