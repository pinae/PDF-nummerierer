import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { routes } from "./routes";
import { AppThemeProvider } from "./theme/AppThemeProvider";

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <AppThemeProvider>
      <RouterProvider router={router} />
    </AppThemeProvider>
  );
}
