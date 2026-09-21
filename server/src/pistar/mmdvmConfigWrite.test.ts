import { describe, expect, it } from "vitest";
import type { FullConfig } from "@pistar/shared";
import { buildDmrGatewayFileEdits, buildMmdvmHostEdits } from "./mmdvmConfigWrite.js";

function configWithDmr(overrides: Partial<FullConfig["dmrGateway"]>): FullConfig {
  return {
    general: { callsign: "W3EZE", dmrId: "3227057", latitude: 0, longitude: 0, location: "", description: "", url: "", radio: "Other", timezone: "UTC" },
    dmrGateway: {
      enabled: true,
      id: "3227057",
      essid: "",
      colorCode: 1,
      ts1Enabled: false,
      ts2Enabled: true,
      mode: "direct",
      master: "3102.master.brandmeister.network",
      masterPort: 62031,
      networkPassword: "hunter2xyz",
      bmApiKey: "",
      ...overrides,
    },
  } as FullConfig;
}

function edit(edits: ReturnType<typeof buildMmdvmHostEdits>, section: string, key: string) {
  return edits.find((e) => e.section === section && e.key === key)?.value;
}

describe("buildMmdvmHostEdits — dmrGateway (direct mode)", () => {
  it("writes the master, port and a QUOTED password, like Pi-Star/WPSD", () => {
    const edits = buildMmdvmHostEdits("dmrGateway", configWithDmr({}));
    expect(edit(edits, "DMR Network", "Address")).toBe("3102.master.brandmeister.network");
    expect(edit(edits, "DMR Network", "Port")).toBe("62031");
    expect(edit(edits, "DMR Network", "Password")).toBe('"hunter2xyz"');
    expect(edit(edits, "DMR", "Id")).toBe("3227057");
    expect(edit(edits, "General", "Id")).toBe("3227057");
    expect(buildDmrGatewayFileEdits(configWithDmr({}))).toEqual([]);
  });

  it("quotes so a '#' in the password survives MMDVMHost's comment stripping", () => {
    const edits = buildMmdvmHostEdits("dmrGateway", configWithDmr({ networkPassword: "ab#c;d=e" }));
    expect(edit(edits, "DMR Network", "Password")).toBe('"ab#c;d=e"');
  });

  it("trims stray whitespace from the password, master and id", () => {
    const edits = buildMmdvmHostEdits(
      "dmrGateway",
      configWithDmr({ networkPassword: " hunter2xyz\t", master: " 3102.master.brandmeister.network ", id: "3227057 " }),
    );
    expect(edit(edits, "DMR Network", "Password")).toBe('"hunter2xyz"');
    expect(edit(edits, "DMR Network", "Address")).toBe("3102.master.brandmeister.network");
    expect(edit(edits, "DMR", "Id")).toBe("3227057");
  });

  it("appends the ESSID to the [DMR] Id only, keeping [General] Id bare", () => {
    const edits = buildMmdvmHostEdits("dmrGateway", configWithDmr({ essid: "01" }));
    expect(edit(edits, "DMR", "Id")).toBe("322705701");
    expect(edit(edits, "General", "Id")).toBe("3227057");
  });
});

describe("buildMmdvmHostEdits — dmrGateway (gateway mode)", () => {
  const cfg = configWithDmr({ mode: "gateway", essid: "02", networkPassword: "bmsecret" });

  it("points MMDVMHost at the local DMRGateway with the placeholder password", () => {
    const edits = buildMmdvmHostEdits("dmrGateway", cfg);
    expect(edit(edits, "DMR Network", "Address")).toBe("127.0.0.1");
    expect(edit(edits, "DMR Network", "Port")).toBe("62031");
    expect(edit(edits, "DMR Network", "Local")).toBe("62032");
    expect(edit(edits, "DMR Network", "Password")).toBe('"none"');
    expect(edit(edits, "DMR", "Id")).toBe("3227057");
  });

  it("puts the real master, password and ESSID-suffixed Id in the DMRGateway file", () => {
    const edits = buildDmrGatewayFileEdits(cfg);
    expect(edit(edits, "DMR Network 1", "Address")).toBe("3102.master.brandmeister.network");
    expect(edit(edits, "DMR Network 1", "Password")).toBe('"bmsecret"');
    expect(edit(edits, "DMR Network 1", "Enabled")).toBe("1");
    const id = edits.find((e) => e.key === "Id");
    expect(id?.value).toBe("322705702");
    expect(id?.insertIfMissing).toBe(true);
  });
});

describe("buildMmdvmHostEdits — general", () => {
  it("preserves a direct-mode ESSID on [DMR] Id when the General tab is saved", () => {
    const edits = buildMmdvmHostEdits("general", configWithDmr({ essid: "05" }));
    expect(edit(edits, "General", "Id")).toBe("3227057");
    expect(edit(edits, "DMR", "Id")).toBe("322705705");
  });
});
