import { describe, expect, it } from "vitest";
import { guessArea, nextRevision, parseDrawingFileName as p } from "@/lib/drawing-name";

describe("reading drawing details from the file name", () => {
  it.each([
    ["MSW-2611-DK-105_C02_Level 5 Deck Layout.pdf", "MSW-2611-DK-105", "C02", "Level 5 Deck Layout"],
    ["2611-SN-201 Rev P03 - Netting Layout L3.pdf", "2611-SN-201", "P03", "Netting Layout L3"],
    ["MSW-2611-DK-105-C02.pdf", "MSW-2611-DK-105", "C02", ""],
    ["MSW-2611-ST-301 rev B Stud layout.pdf", "MSW-2611-ST-301", "B", "Stud layout"],
    ["Deck layout level 2 (C01).pdf", "", "C01", "Deck layout level 2"],
    ["scan0001.pdf", "", "", "scan0001"],
  ])("%s", (file, docNumber, revision, title) => {
    expect(p(file)).toMatchObject({ docNumber, revision, title });
  });
  it("spots RAMS", () => {
    expect(p("BM RAMS - Metal deck installation rev 3.pdf")).toMatchObject({ kind: "rams", revision: "3" });
    expect(p("MSW-2611-DK-101 C02.pdf").kind).toBe("drawing");
  });
  it("suggests the next revision", () => {
    expect([nextRevision("C01"), nextRevision("P09"), nextRevision("B"), nextRevision("")]).toEqual(["C02", "P10", "C", ""]);
  });
  it("guesses the area only when exactly one matches", () => {
    const areas = [{ id: "1", name: "Level 1" }, { id: "3", name: "Level 3" }, { id: "r", name: "Roof" }];
    expect(guessArea("Netting Layout L3", areas)).toBe("3");
    expect(guessArea("Deck_Level_1_layout", areas)).toBe("1");
    expect(guessArea("Roof edge trims", areas)).toBe("r");
    expect(guessArea("Levels 1 and 3", areas)).toBe("");
    expect(guessArea("General arrangement", areas)).toBe("");
  });
});
