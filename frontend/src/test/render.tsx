import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type InitialEntry } from "react-router";

import { routes } from "../routes";
import { AppThemeProvider } from "../theme/AppThemeProvider";

/** Render the whole app at `entry` (a path, or a location with history state). */
export function renderRoute(entry: InitialEntry) {
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  const result = render(
    <AppThemeProvider>
      <RouterProvider router={router} />
    </AppThemeProvider>,
  );
  return { ...result, router };
}
