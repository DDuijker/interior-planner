// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import {
  Button,
  ColorPicker,
  IconButton,
  Modal,
  Tabs,
  TextField,
  ToastProvider,
  useToast,
} from "./index";

function wrap(ui: React.ReactNode) {
  return render(<I18nProvider initial="en">{ui}</I18nProvider>);
}

afterEach(() => vi.useRealTimers());

describe("Button", () => {
  it("is a real button that defaults to type=button", () => {
    render(<Button variant="primary">Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveClass("btn-primary");
  });

  it("gives icon buttons an accessible name and pressed state", () => {
    render(<IconButton icon="undo" label="Undo" pressed />);
    const btn = screen.getByRole("button", { name: "Undo" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("TextField", () => {
  it("links label, hint and error", () => {
    render(<TextField label="Width" hint="In cm" error="Too wide" />);
    const input = screen.getByLabelText("Width");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toMatch(/hint.*error/);
    expect(screen.getByRole("alert")).toHaveTextContent("Too wide");
  });
});

describe("Tabs", () => {
  function Demo() {
    const [value, setValue] = useState("a");
    return (
      <Tabs
        label="Views"
        value={value}
        onChange={setValue}
        items={[
          { id: "a", label: "2D", content: "plan" },
          { id: "b", label: "3D", content: "scene" },
          { id: "c", label: "Style", content: "style" },
        ]}
      />
    );
  }

  it("moves with arrow keys, Home and End", () => {
    render(<Demo />);
    const first = screen.getByRole("tab", { name: "2D" });
    expect(first).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "3D" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("scene");
    fireEvent.keyDown(screen.getByRole("tab", { name: "3D" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Style" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Style" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "2D" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "2D" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Style" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("ColorPicker", () => {
  it("picks swatches and validates hex input", () => {
    const onChange = vi.fn();
    wrap(<ColorPicker value="#87A08C" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "#87A08C" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "#4D6857" }));
    expect(onChange).toHaveBeenLastCalledWith("#4D6857");

    const hex = screen.getByLabelText("Hex code");
    fireEvent.change(hex, { target: { value: "#abc" } });
    expect(screen.getByText("Use a hex code like #4D6857")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.change(hex, { target: { value: "#a1b2c3" } });
    expect(onChange).toHaveBeenLastCalledWith("#A1B2C3");
  });
});

describe("Modal", () => {
  it("renders a labelled dialog and closes on Escape", () => {
    const onClose = vi.fn();
    wrap(
      <Modal open title="Shortcuts" onClose={onClose}>
        body
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toHaveAccessibleName("Shortcuts");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close", hidden: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("Toast", () => {
  function Trigger() {
    const toast = useToast();
    return <button onClick={() => toast("Saved", "success")}>go</button>;
  }

  it("announces and auto-dismisses", () => {
    vi.useFakeTimers();
    wrap(
      <ToastProvider duration={1000}>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("status")).not.toHaveTextContent("Saved");
  });
});
