/** WP9: loading and saving named, versioned configurations in the workspace. */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import type { NumberingConfig } from "../api/types";
import { ptToMm } from "../pdf/coordinates";
import { strings } from "../strings";
import { renderRoute } from "../test/render";
import { server } from "../test/server";

const A4: [number, number] = [595.28, 841.89];
const text = strings.configs;

const algorithms: NumberingConfig = {
  id: "c-alg-1",
  name: "Algorithms exam",
  version: 1,
  created_at: "2026-11-01T10:00:00+00:00",
  number_format: { prefix: "", digits: 4, suffix: "" },
  placements: {
    first: { x: 400, y: 800, font: "cmu-serif", font_size: 12 },
    odd: { x: 400, y: 800, font: "cmu-serif", font_size: 12 },
    even: { x: 400, y: 800, font: "cmu-serif", font_size: 12 },
  },
};
const hciV1: NumberingConfig = {
  id: "c-hci-1",
  name: "HCI Exam",
  version: 1,
  created_at: "2026-10-01T10:00:00+00:00",
  number_format: { prefix: "", digits: 4, suffix: "" },
  placements: {
    first: { x: 50, y: 60, font: "cmu-serif", font_size: 12 },
    odd: null,
    even: null,
  },
};
const hciV2: NumberingConfig = {
  id: "c-hci-2",
  name: "HCI Exam",
  version: 2,
  created_at: "2026-11-02T10:00:00+00:00",
  number_format: { prefix: "A-", digits: 3, suffix: "" },
  placements: {
    first: { x: 227, y: 661, font: "cmu-serif", font_size: 12 },
    odd: null,
    even: { x: 144, y: 780, font: "caveat", font_size: 14 },
  },
};

let posted: unknown[] = [];

beforeEach(() => {
  posted = [];
  document.cookie = "csrftoken=t; path=/";
  server.use(
    http.get("/api/documents/d1/", () =>
      HttpResponse.json({
        id: "d1",
        name: "exam.pdf",
        size: 1,
        page_count: 3,
        page_sizes: [A4, A4, A4],
        created_at: "2026-11-04T12:00:00+00:00",
        expires_at: "2026-11-04T14:00:00+00:00",
      }),
    ),
    http.get("/api/configs/", () => HttpResponse.json([algorithms, hciV2])),
    http.get("/api/configs/:id/versions/", ({ params }) => {
      const history: Record<string, NumberingConfig[]> = {
        "c-alg-1": [algorithms],
        "c-hci-1": [hciV2, hciV1],
        "c-hci-2": [hciV2, hciV1],
      };
      return HttpResponse.json(history[params.id as string] ?? []);
    }),
  );
});

async function openWorkspace() {
  renderRoute("/exams/d1");
  await screen.findByText("exam.pdf");
  await waitFor(() => expect(configSelect()).toBeEnabled());
}

const configSelect = () => screen.getByRole("combobox", { name: text.saved });
const versionSelect = () => screen.getByRole("combobox", { name: text.version });
const stamp = () => screen.getByRole("button", { name: /^Number on/ });

async function choose(select: HTMLElement, option: string | RegExp) {
  await userEvent.click(select);
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

async function exactPosition() {
  await userEvent.click(screen.getByRole("button", { name: strings.placement.exactPosition }));
  return {
    left: (screen.getByLabelText(strings.placement.fromLeft) as HTMLInputElement).value,
    bottom: (screen.getByLabelText(strings.placement.fromBottom) as HTMLInputElement).value,
  };
}

function respondToSave(status: number, body: JsonBodyType) {
  server.use(
    http.post("/api/configs/", async ({ request }) => {
      posted.push(await request.json());
      return HttpResponse.json(body, { status });
    }),
  );
}

async function saveAs(name: string | null) {
  await userEvent.click(screen.getByRole("button", { name: text.save }));
  const dialog = await screen.findByRole("dialog", { name: text.saveTitle });
  const field = within(dialog).getByLabelText(text.name);
  if (name !== null) {
    await userEvent.clear(field);
    await userEvent.type(field, name);
  }
  return dialog;
}

describe("saved configurations", () => {
  it("starts with nothing loaded", async () => {
    await openWorkspace();

    expect(screen.getByText(text.notSaved)).toBeVisible();
    expect(screen.queryByText(text.modified)).not.toBeInTheDocument();
  });

  it("applies a chosen configuration instantly", async () => {
    await openWorkspace();

    await choose(configSelect(), /^HCI Exam/);

    expect(stamp()).toHaveTextContent("A-001");
    expect(await exactPosition()).toEqual({
      left: ptToMm(227).toFixed(1),
      bottom: ptToMm(661).toFixed(1),
    });
    expect(screen.getByRole("button", { name: /^Odd pages/ })).toHaveTextContent(
      strings.placement.off,
    );
    expect(screen.getByText(text.status(2, 2))).toBeVisible();
    expect(screen.queryByText(text.modified)).not.toBeInTheDocument();
  });

  it("can load an older version", async () => {
    await openWorkspace();
    await choose(configSelect(), /^HCI Exam/);

    await choose(versionSelect(), /^Version 1/);

    expect(stamp()).toHaveTextContent("0001");
    expect((await exactPosition()).left).toBe(ptToMm(50).toFixed(1));
    expect(screen.getByText(text.status(1, 2))).toBeVisible();
  });

  it("marks the settings as modified after a change", async () => {
    await openWorkspace();
    await choose(configSelect(), /^Algorithms exam/);
    expect(screen.queryByText(text.modified)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: strings.placement.nudge.left }));

    expect(screen.getByText(text.modified)).toBeVisible();
  });

  it("saves under a new name as a new configuration", async () => {
    await openWorkspace();
    respondToSave(201, { ...algorithms, id: "c-new-1", name: "Databases exam", version: 1 });

    const dialog = await saveAs("Databases exam");
    expect(within(dialog).getByText(text.createsNew)).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: text.save }));

    expect(await screen.findByText(text.saved_(`Databases exam`, 1))).toBeVisible();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      name: "Databases exam",
      number_format: { prefix: "", digits: 4, suffix: "" },
      placements: { first: expect.objectContaining({ font: "cmu-serif", font_size: 12 }) },
    });
    expect(screen.getByText(text.status(1, 1))).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("saves changes to a loaded configuration as its next version", async () => {
    await openWorkspace();
    await choose(configSelect(), /^HCI Exam/);
    await userEvent.click(screen.getByRole("button", { name: strings.placement.nudge.right }));
    respondToSave(201, { ...hciV2, id: "c-hci-3", version: 3 });

    const dialog = await saveAs(null);
    expect(within(dialog).getByLabelText(text.name)).toHaveValue("HCI Exam");
    expect(within(dialog).getByText(text.nextVersion("HCI Exam", 3))).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: text.save }));

    expect(await screen.findByText(text.saved_("HCI Exam", 3))).toBeVisible();
    expect(posted[0]).toMatchObject({
      name: "HCI Exam",
      number_format: { prefix: "A-", digits: 3, suffix: "" },
      placements: { odd: null },
    });
    expect(screen.queryByText(text.modified)).not.toBeInTheDocument();
  });

  it("recognises an existing name regardless of case and spaces", async () => {
    await openWorkspace();

    const dialog = await saveAs("  algorithms   EXAM ");

    expect(within(dialog).getByText(text.nextVersion("Algorithms exam", 2))).toBeVisible();
  });

  it("reports when nothing changed", async () => {
    await openWorkspace();
    await choose(configSelect(), /^HCI Exam/);
    respondToSave(200, hciV2);

    const dialog = await saveAs(null);
    await userEvent.click(within(dialog).getByRole("button", { name: text.save }));

    expect(await screen.findByText(text.unchanged(2))).toBeVisible();
  });

  it("shows why saving failed and keeps the dialog open", async () => {
    await openWorkspace();
    respondToSave(400, {
      error: {
        code: "invalid",
        message: "Some values are not valid.",
        fields: { "number_format.prefix": ["Caveat cannot print these characters: 中"] },
      },
    });

    const dialog = await saveAs("Broken");
    await userEvent.click(within(dialog).getByRole("button", { name: text.save }));

    expect(await within(dialog).findByText(/Caveat cannot print/)).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("needs a name", async () => {
    await openWorkspace();

    const dialog = await saveAs("   ");

    expect(within(dialog).getByRole("button", { name: text.save })).toBeDisabled();
  });

  it("asks before replacing unsaved changes", async () => {
    await openWorkspace();
    await choose(configSelect(), /^Algorithms exam/);
    await userEvent.click(screen.getByRole("button", { name: strings.placement.nudge.left }));
    const changed = (await exactPosition()).left;

    await choose(configSelect(), /^HCI Exam/);
    const confirm = await screen.findByRole("dialog", { name: text.discardTitle });
    await userEvent.click(within(confirm).getByRole("button", { name: text.keepEditing }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText(strings.placement.fromLeft)).toHaveValue(Number(changed));

    await choose(configSelect(), /^HCI Exam/);
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: text.discardTitle })).getByRole("button", {
        name: text.discard,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(stamp()).toHaveTextContent("A-001");
  });

  it("keeps working when the list cannot be loaded", async () => {
    server.use(http.get("/api/configs/", () => HttpResponse.error()));
    renderRoute("/exams/d1");

    expect(await screen.findByText(text.listError)).toBeVisible();
    expect(screen.getByRole("button", { name: text.save })).toBeEnabled();
  });
});
