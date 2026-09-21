import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readCredentialsFile, writeCredentialsFile } from "./credentialsFile.js";

describe("credentialsFile", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "pistar-creds-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns null when the file does not exist", async () => {
    expect(await readCredentialsFile(path.join(dir, "auth.json"))).toBeNull();
  });

  it("round-trips credentials and creates the parent directory", async () => {
    const file = path.join(dir, "nested", "auth.json");
    const creds = { username: "admin", passwordHash: "$2a$10$abcdefghijklmnopqrstuv" };
    await writeCredentialsFile(file, creds);
    expect(await readCredentialsFile(file)).toEqual(creds);
    // Only the two expected keys are written — never a plaintext password.
    expect(Object.keys(JSON.parse(await readFile(file, "utf8")))).toEqual(["username", "passwordHash"]);
  });

  it("treats malformed or non-bcrypt content as absent", async () => {
    const file = path.join(dir, "auth.json");
    await writeFile(file, "not json");
    expect(await readCredentialsFile(file)).toBeNull();
    await writeFile(file, JSON.stringify({ username: "admin", passwordHash: "plaintext" }));
    expect(await readCredentialsFile(file)).toBeNull();
    await writeFile(file, JSON.stringify({ username: "", passwordHash: "$2a$10$x" }));
    expect(await readCredentialsFile(file)).toBeNull();
  });
});
