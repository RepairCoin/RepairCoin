import { useState } from "react";
import { AppointmentFilterStatus } from "../../types";

export function useBookingsFilter() {
  const [statusFilter, setStatusFilter] = useState<AppointmentFilterStatus>("all");

  return {
    statusFilter,
    setStatusFilter,
  };
}
