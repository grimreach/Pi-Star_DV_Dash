import { describe, expect, it } from "vitest";
import { parseDmrGatewayNetwork1, splitEssid } from "./dmrGatewayConfig.js";

const SAMPLE = `[General]
Daemon=1
RptAddress=127.0.0.1

[DMR Network 1]
Enabled=1
Name=BM_3102_United_States
Address=3102.master.brandmeister.network
Port=62031
Password="hunter2xyz"
Id=322705701
TGRewrite0=2,8,2,8,1
Debug=0

[DMR Network 2]
Enabled=0
Name=DMR+_IPSC2
Address=1.2.3.4
Port=55555
Password="PASSWORD"
`;

describe("parseDmrGatewayNetwork1", () => {
  it("reads only the BrandMeister network block, stripping quotes", () => {
    expect(parseDmrGatewayNetwork1(SAMPLE)).toEqual({
      enabled: true,
      name: "BM_3102_United_States",
      address: "3102.master.brandmeister.network",
      port: 62031,
      password: "hunter2xyz",
      id: "322705701",
    });
  });
});

describe("splitEssid", () => {
  it("returns the suffix beyond the base id, or empty", () => {
    expect(splitEssid("322705701", "3227057")).toBe("01");
    expect(splitEssid("3227057", "3227057")).toBe("");
    expect(splitEssid("", "3227057")).toBe("");
    expect(splitEssid("999999901", "3227057")).toBe("");
  });
});
