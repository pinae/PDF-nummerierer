import { setupServer } from "msw/node";

/** API mock for all frontend tests; tests add handlers with server.use(...). */
export const server = setupServer();
