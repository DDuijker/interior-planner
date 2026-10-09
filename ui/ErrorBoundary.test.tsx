// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SettingsProvider } from "@/ui/settings/settings";
import { ErrorBoundary } from "./ErrorBoundary";

let fail = true;
function Bomb() {
  const [n] = useState(0);
  if (fail) throw new Error(`Boom sk-ant-secret ${n}`);
  return <p>All good</p>;
}

describe("ErrorBoundary", () => {
  it("shows recovery, a scrubbed report on request, and retries", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("maison.settings", JSON.stringify({ errorReports: true }));
    render(
      <SettingsProvider>
        <I18nProvider initial="en">
          <ErrorBoundary>
            <Bomb />
          </ErrorBoundary>
        </I18nProvider>
      </SettingsProvider>,
    );
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prepare an error report" }));
    const report = screen.getByLabelText("Error report") as HTMLTextAreaElement;
    expect(report.value).toContain("Boom [key removed]");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("All good")).toBeInTheDocument();
  });
});
