import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../i18n";
import { ConfirmDialogHost } from "../components/ConfirmDialog";
import { confirmAction, promptText } from "./dialogs";

const showHost = () => render(<ConfirmDialogHost />);

describe("confirmAction and promptText", () => {
  it("asks in the shared confirmation dialog with the action as the button and the record as facts", async () => {
    showHost();
    let answer;
    act(() => {
      confirmAction("The template below will be deleted.", {
        header: "Delete template", acceptLabel: "Delete template", danger: true, facts: [{ label: "Template", value: "Overdue notice" }],
      }).then((v) => { answer = v; });
    });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Overdue notice")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Yes" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete template" }));
    await waitFor(() => expect(answer).toBe(true));
  });

  it("resolves false when cancelled", async () => {
    showHost();
    let answer;
    act(() => {
      confirmAction("The job runs now.", { header: "Run job", acceptLabel: "Run job" }).then((v) => { answer = v; });
    });
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(answer).toBe(false));
  });

  it("returns the text entered, and asks again for a required text left empty", async () => {
    showHost();
    let answer;
    act(() => {
      promptText("Reason", "", { header: "Reject change", acceptLabel: "Reject change", minLength: 3 }).then((v) => { answer = v; });
    });
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject change" }));
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "  Wrong account  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject change" }));
    await waitFor(() => expect(answer).toBe("Wrong account"));
  });
});
