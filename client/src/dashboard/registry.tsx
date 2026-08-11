import type { ComponentType } from "react";
import {
  DStarNetworkWidget,
  DStarRepeaterWidget,
  DmrMasterWidget,
  DmrRepeaterWidget,
  GatewayActivityWidget,
  LocalRfActivityWidget,
  ModesEnabledWidget,
  NetworkStatusWidget,
  RadioInfoWidget,
} from "./widgets";
import { LinkStatusWidget } from "./widgets/LinkStatusWidget";
import { LiveLogWidget } from "./widgets/LiveLogWidget";
import { SystemInfoWidget } from "./widgets/SystemInfoWidget";
import { WifiStatusWidget } from "./widgets/WifiStatusWidget";

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetDef {
  id: string;
  title: string;
  component: ComponentType;
  defaultLayout: WidgetLayout;
  minW: number;
  minH: number;
}

// 12-column grid. Narrow info panels take 3 cols (roughly the old fixed
// 260px sidebar), tables/logs take 9.
export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "modes-enabled", title: "Modes Enabled", component: ModesEnabledWidget, defaultLayout: { x: 0, y: 0, w: 3, h: 3 }, minW: 2, minH: 2 },
  { id: "network-status", title: "Network Status", component: NetworkStatusWidget, defaultLayout: { x: 0, y: 3, w: 3, h: 3 }, minW: 2, minH: 2 },
  { id: "radio-info", title: "Radio Info", component: RadioInfoWidget, defaultLayout: { x: 0, y: 6, w: 3, h: 4 }, minW: 2, minH: 3 },
  { id: "dstar-repeater", title: "D-Star Repeater", component: DStarRepeaterWidget, defaultLayout: { x: 0, y: 10, w: 3, h: 3 }, minW: 2, minH: 2 },
  { id: "dstar-network", title: "D-Star Network", component: DStarNetworkWidget, defaultLayout: { x: 0, y: 13, w: 3, h: 3 }, minW: 2, minH: 2 },
  { id: "dmr-repeater", title: "DMR Repeater", component: DmrRepeaterWidget, defaultLayout: { x: 0, y: 16, w: 3, h: 4 }, minW: 2, minH: 3 },
  { id: "dmr-master", title: "DMR Master", component: DmrMasterWidget, defaultLayout: { x: 0, y: 20, w: 3, h: 2 }, minW: 2, minH: 2 },
  { id: "system-info", title: "System Info", component: SystemInfoWidget, defaultLayout: { x: 0, y: 22, w: 3, h: 5 }, minW: 2, minH: 3 },
  { id: "link-status", title: "Link Status", component: LinkStatusWidget, defaultLayout: { x: 0, y: 27, w: 3, h: 4 }, minW: 2, minH: 2 },
  { id: "wifi-status", title: "WiFi Status", component: WifiStatusWidget, defaultLayout: { x: 0, y: 31, w: 3, h: 3 }, minW: 2, minH: 2 },
  { id: "gateway-activity", title: "Gateway Activity", component: GatewayActivityWidget, defaultLayout: { x: 3, y: 0, w: 9, h: 8 }, minW: 4, minH: 4 },
  { id: "local-rf-activity", title: "Local RF Activity", component: LocalRfActivityWidget, defaultLayout: { x: 3, y: 8, w: 9, h: 8 }, minW: 4, minH: 4 },
  { id: "live-log", title: "Live Log", component: LiveLogWidget, defaultLayout: { x: 3, y: 16, w: 9, h: 6 }, minW: 4, minH: 3 },
];

export const WIDGET_MAP = new Map(WIDGET_REGISTRY.map((w) => [w.id, w]));
