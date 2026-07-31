import { ServiceData } from "@/feature/services/services/service.interface";

/**
 * A rendered row of the services grid. FlatList's `numColumns` forces every item to the same
 * width, so the list is instead pre-chunked into rows of SERVICES_PER_ROW and rendered as a
 * single-column list — each row is just a flex-row of fixed-width service cards.
 */
export type ServiceGridRow = { kind: "services"; key: string; items: ServiceData[] };

export const SERVICES_PER_ROW = 2;

/**
 * Chunk services into two-column grid rows.
 *
 * An empty service list yields NO rows — not a placeholder — so the screen's empty state
 * still shows.
 */
export function buildServiceRows(
  services: ServiceData[] | undefined,
): ServiceGridRow[] {
  const list = services ?? [];
  const rows: ServiceGridRow[] = [];
  for (let i = 0; i < list.length; i += SERVICES_PER_ROW) {
    const items = list.slice(i, i + SERVICES_PER_ROW);
    rows.push({ kind: "services", key: `services-${items[0].serviceId}`, items });
  }
  return rows;
}
