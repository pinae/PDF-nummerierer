import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("shows the application name as the main heading", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "PDF-Nummerierer" })).toBeInTheDocument();
  });

  it("explains what the app does", () => {
    render(<App />);

    expect(screen.getByText(/serial numbers/i)).toBeInTheDocument();
  });
});
