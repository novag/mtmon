export interface MeshtasticNode {
  id: number;
  legacy: boolean;
  hop_limit?: number;
  message_count: number;
  first_seen: string;
  position?: {
    latitude_i: number;
    longitude_i: number;
    altitude: number;
    time: number;
    location_source: string;
    precision_bits: number;
  };
  info?: {
    short_name: string;
    long_name: string;
    hw_model: string;
    role: string;
  };
  metrics?: {
    device_metrics?: {
      channel_utilization: number;
      air_util_tx: number;
    };
  };
  gateways?: {
    last_seen: string;
    gateway_id: number;
  }[];
  message_count_24h?: number;
  avg_msg_per_hour_24h?: number;
}

export interface Packet {
  id: number;
  first_seen: string;
  from_id: number;
  to_id: number;
  want_ack: boolean;
  via_mqtt: boolean;
  hop_start: number;
  port: string;
  payload: unknown;
  hops: {
    gateway_id: number;
    seen_at: string;
    hop_limit: number;
    rssi: number;
    snr: number;
    relay_node?: number | null;
  }[];
}
