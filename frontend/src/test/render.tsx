import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { routes } from "../routes";
import { AppThemeProvider } from "../theme/AppThemeProvider";

/** Render the whole app at `path`, like a user opening that URL. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <AppThemeProvider>
      <RouterProvider router={router} />
    </AppThemeProvider>,
  );
  return { ...result, router };
}
