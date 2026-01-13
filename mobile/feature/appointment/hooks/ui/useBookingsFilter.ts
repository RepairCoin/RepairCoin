import { useState } from "react";
import { BookingFilterStatus } from "../../types";

export function useBookingsFilter() {
  const [statusFilter, setStatusFilter] = useState<BookingFilterStatus>("all");

  return {
    statusFilter,
    setStatusFilter,
  };
}
