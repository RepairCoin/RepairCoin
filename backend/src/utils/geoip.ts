import { logger } from './logger';

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(range => range.test(ip));
}

/**
 * Look up geographic location from an IP address using ip-api.com (free tier).
 * Returns "City, Country" or a fallback string. Never throws.
 */
export async function getLocationFromIP(ip: string): Promise<string> {
  if (!ip) return 'Unknown';

  // Strip IPv6-mapped IPv4 prefix
  const cleanIP = ip.replace(/^::ffff:/, '');

  if (isPrivateIP(cleanIP)) return 'Local network';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      `http://ip-api.com/json/${cleanIP}?fields=status,city,country`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) return 'Unknown location';

    const data = await response.json();
    if (data.status === 'success' && data.city && data.country) {
      return `${data.city}, ${data.country}`;
    }
    return 'Unknown location';
  } catch (error) {
    logger.debug('Geo-IP lookup failed', { ip: cleanIP, error: (error as Error).message });
    return 'Unknown location';
  }
}
