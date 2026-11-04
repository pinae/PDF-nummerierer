import { Navigate, type RouteObject } from "react-router";

import { AppShell } from "./components/AppShell";
import { DoneScreen } from "./screens/DoneScreen";
import { UploadScreen } from "./screens/UploadScreen";
import { WorkspaceScreen } from "./screens/WorkspaceScreen";

/** Upload → workspace of one exam (reload-safe URL) → done. */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <UploadScreen /> },
      { path: "exams/:documentId", element: <WorkspaceScreen /> },
      { path: "done", element: <DoneScreen /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];
