export interface DirectLinkData {
  from_node_id: number;
  to_node_id: number;
  last_seen: string;
  last_snr: number | null;
  last_rssi: number | null;
  source: string;
  observation_count: number;
}

export interface ProcessedLink {
  node1_id: number;
  node2_id: number;
  pos1?: [number, number] | null; // Optional position
  pos2?: [number, number] | null; // Optional position
  direction: "bidirectional" | "AtoB" | "BtoA";
  link1?: DirectLinkData; // Data for A -> B
  link2?: DirectLinkData; // Data for B -> A
}

// Link quality thresholds
export const SNR_GOOD_THRESHOLD = -7.0;
export const SNR_FAIR_THRESHOLD = -15.0;
export const RSSI_GOOD_THRESHOLD = -115;
export const RSSI_FAIR_THRESHOLD = -126;

export function getLinkColor(link: ProcessedLink): string {
  const snrValues: number[] = [];
  const rssiValues: number[] = [];

  if (link.link1?.last_snr !== null && link.link1?.last_snr !== undefined) {
    snrValues.push(link.link1.last_snr);
  }
  if (link.link1?.last_rssi !== null && link.link1?.last_rssi !== undefined) {
    rssiValues.push(link.link1.last_rssi);
  }
  if (link.link2?.last_snr !== null && link.link2?.last_snr !== undefined) {
    snrValues.push(link.link2.last_snr);
  }
  if (link.link2?.last_rssi !== null && link.link2?.last_rssi !== undefined) {
    rssiValues.push(link.link2.last_rssi);
  }

  const hasSnr = snrValues.length > 0;
  const hasRssi = rssiValues.length > 0;
  const hasMatchingPairs =
    hasSnr && hasRssi && snrValues.length === rssiValues.length;

  if (hasMatchingPairs) {
    const avgSnr = snrValues.reduce((a, b) => a + b, 0) / snrValues.length;
    const avgRssi = rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length;

    if (avgSnr > SNR_GOOD_THRESHOLD && avgRssi > RSSI_GOOD_THRESHOLD) {
      return "#10b981"; // GOOD - Emerald green
    } else if (
      (avgSnr > SNR_GOOD_THRESHOLD && avgRssi > RSSI_FAIR_THRESHOLD) ||
      (avgSnr > SNR_FAIR_THRESHOLD && avgRssi > RSSI_GOOD_THRESHOLD)
    ) {
      return "#f59e0b"; // FAIR - Amber yellow
    } else if (avgSnr <= SNR_FAIR_THRESHOLD && avgRssi <= RSSI_FAIR_THRESHOLD) {
      return "#ef4444"; // NONE - Red
    } else {
      return "#f97316"; // BAD - Orange
    }
  } else if (hasSnr) {
    const avgSnr = snrValues.reduce((a, b) => a + b, 0) / snrValues.length;
    if (avgSnr > SNR_GOOD_THRESHOLD) {
      return "#10b981"; // GOOD - Emerald green
    } else if (avgSnr > SNR_FAIR_THRESHOLD) {
      return "#f59e0b"; // FAIR - Amber yellow
    } else {
      return "#ef4444"; // NONE - Red
    }
  } else {
    return "#94a3b8"; // Slate gray for unknown
  }
}
