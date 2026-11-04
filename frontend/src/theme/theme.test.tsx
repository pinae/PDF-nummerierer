import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppThemeProvider } from "./AppThemeProvider";
import { theme } from "./theme";

function injectedCss(): string {
  return Array.from(document.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n");
}

describe("theme", () => {
  it("offers a light and a dark color scheme", () => {
    expect(Object.keys(theme.colorSchemes).sort()).toEqual(["dark", "light"]);
  });

  it("follows the browser's color scheme preference via CSS, without JavaScript", () => {
    expect(theme.colorSchemeSelector).toBe("media");
  });

  it("emits the dark palette inside a prefers-color-scheme media query", () => {
    render(
      <AppThemeProvider>
        <p>content</p>
      </AppThemeProvider>,
    );

    const css = injectedCss();
    const darkBlock = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(darkBlock).toContain(
      `--mui-palette-background-default:${theme.colorSchemes.dark?.palette.background.default}`,
    );
  });

  it("uses the system font stack instead of downloading a web font", () => {
    expect(theme.typography.fontFamily).toMatch(/^system-ui/);
  });
});
