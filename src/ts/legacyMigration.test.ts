import { describe, expect, it } from "vitest";
import { readLegacyArchive } from "./legacyMigration.ts";

function createFile(value: unknown): File {
  return new File(
    [JSON.stringify(value)],
    "legacy.json",
    { type: "application/json" },
  );
}

const validResult = {
  id: "result-1",
  date: "2026-10-15T12:00:00.000Z",
  grade: 2,
  totalQuestions: 4,
  correctAnswers: 3,
  timeLimitSec: null,
  timeTakenMs: 120_000,
  typeStats: [
    {
      typeId: "addition",
      typeLabel: "Додавання",
      total: 4,
      correct: 3,
      finalDifficulty: "easy",
      level: 4,
    },
  ],
  bestTypeId: "addition",
  worstTypeId: "addition",
};

const validArchive = {
  format: "math-test-local-v1",
  exportedAt: "2026-11-09T18:00:00.000Z",
  sourceOrigin: "https://old.example.com",
  accounts: [{ id: "old-student", name: "Учень", role: "student" }],
  histories: { "old-student": [validResult] },
};

describe("legacy local data archive", () => {
  it("validates the archive and calculates its fingerprint and result count", async () => {
    const archive = await readLegacyArchive(createFile(validArchive));

    expect(archive.payload.accounts).toHaveLength(1);
    expect(archive.resultCount).toBe(1);
    expect(archive.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects archives with an unsupported format", async () => {
    await expect(
      readLegacyArchive(createFile({ ...validArchive, format: "other" })),
    ).rejects.toThrow("math-test-local-v1");
  });

  it("rejects malformed result records instead of importing partial data", async () => {
    await expect(
      readLegacyArchive(
        createFile({
          ...validArchive,
          histories: { "old-student": [{ id: "broken" }] },
        }),
      ),
    ).rejects.toThrow("некоректні записи");
  });
});
