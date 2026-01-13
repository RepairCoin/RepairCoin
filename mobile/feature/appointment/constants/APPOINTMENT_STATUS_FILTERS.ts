import { AppointmentFilterStatus } from "../types";

export const APPOINTMENT_STATUS_FILTERS: {
  label: string;
  value: AppointmentFilterStatus;
}[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Approved", value: "approved" },
  { label: "Completed", value: "completed" },
];
