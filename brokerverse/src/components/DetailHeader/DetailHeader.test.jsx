import React from "react";
import { render, screen } from "@testing-library/react";
import DetailHeader from "./index";
import { setDateFormat } from "../../utility/dateFormat";

const byClass = (name, text) => screen.queryByText((_, el) => !!el?.classList?.contains(name) && (!text || el.textContent === text));

beforeEach(() => setDateFormat("DD/MM/YYYY"));

describe("DetailHeader", () => {
  it("shows the record number with a compact status chip, the party, key facts and the actions", () => {
    render(
      <DetailHeader title="REM-2026-00012" status={{ code: "for-approval", label: "Pending Approval" }} subtitle="Malayan Insurance Co., Inc."
        meta={[{ label: "Net amount", value: 8457.5, type: "amount", currency: "PHP" }, { label: "Due date", value: "2026-10-31", type: "date" },
          { label: "Batch", value: "BLK-1", hidden: true }]}
        actions={<button type="button">Print</button>} />
    );
    expect(screen.getByRole("heading", { name: "REM-2026-00012" })).toBeInTheDocument();
    expect(byClass("p-tag", "Pending Approval")).toHaveClass("bv-status-chip", "p-tag-warning");
    expect(screen.getByText("Malayan Insurance Co., Inc.")).toBeInTheDocument();
    expect(screen.getByText(/8,457\.50/)).toHaveClass("bv-detail-header__num");
    expect(screen.getByText("31/10/2026")).toBeInTheDocument();
    expect(screen.queryByText("Batch")).toBeNull();
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();
  });

  it("takes the status as plain text and leaves out what it is not given", () => {
    render(<DetailHeader title="JV-2026-00001" status="Posted" />);
    expect(byClass("p-tag", "Posted")).toHaveClass("p-tag-success");
    expect(byClass("bv-detail-header__meta")).toBeNull();
    expect(byClass("bv-detail-header__actions")).toBeNull();
  });
});
