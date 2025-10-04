import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert Meshtastic position format to standard latitude/longitude
 * Meshtastic stores coordinates as integers (multiplied by 10^7)
 * @param latitude_i Integer latitude (latitude * 10^7)
 * @param longitude_i Integer longitude (longitude * 10^7)
 * @returns [latitude, longitude] as decimal degrees
 */
export function convertMeshtasticPosition(
  latitude_i?: number,
  longitude_i?: number,
): [number, number] | null {
  if (latitude_i === undefined || longitude_i === undefined) {
    return null;
  }

  // Convert from integer format (multiplied by 10^7) to decimal degrees
  const latitude = latitude_i / 10000000;
  const longitude = longitude_i / 10000000;

  // Check if coordinates are valid
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return [latitude, longitude];
}
