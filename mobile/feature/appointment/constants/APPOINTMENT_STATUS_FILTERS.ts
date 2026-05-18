import { AppointmentFilterStatus } from "../types";

export const APPOINTMENT_STATUS_FILTERS: {
  label: string;
  value: AppointmentFilterStatus;
}[] = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Completed", value: "completed" },
];
