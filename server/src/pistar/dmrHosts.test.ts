import { describe, expect, it } from "vitest";
import { parseDmrHosts, sortDmrHosts } from "./dmrHosts.js";

const SAMPLE = `#\tDMR_Hosts.txt
#
# Name\t\t\t\tDMR-ID\tIP/Hostname\t\t\t\tPassword\tPort #
######################################################################################################
DMRGateway\t\t\t0000\t127.0.0.1\t\t\t\tnone\t\t62031
DMR2YSF\t\t\t\t0000\t127.0.0.2\t\t\t\tnone\t\t62033
XLX_307\t\t\t\t0000\t72.21.76.154\t\t\t\tpassw0rd\t62030
BM_3102_United_States\t3102\t3102.master.brandmeister.network\tpassw0rd\t62031
TGIF_Network\t\t\t0000\ttgif.network\t\t\t\tpassw0rd\t62031
broken line without enough columns
BadPort\t0000\t1.2.3.4\tpw\tnotaport
`;

describe("parseDmrHosts", () => {
  it("parses whitespace-separated rows and skips comments and malformed lines", () => {
    const hosts = parseDmrHosts(SAMPLE);
    expect(hosts.map((h) => h.name)).toEqual(["DMRGateway", "DMR2YSF", "XLX_307", "BM_3102_United_States", "TGIF_Network"]);
    expect(hosts.find((h) => h.name === "BM_3102_United_States")).toEqual({
      name: "BM_3102_United_States",
      id: "3102",
      address: "3102.master.brandmeister.network",
      password: "passw0rd",
      port: 62031,
    });
  });

  it("sorts DMRGateway first, then BrandMeister, then the rest", () => {
    const names = sortDmrHosts(parseDmrHosts(SAMPLE)).map((h) => h.name);
    expect(names).toEqual(["DMRGateway", "BM_3102_United_States", "DMR2YSF", "TGIF_Network", "XLX_307"]);
  });
});
