import { AppointmentFilterStatus } from "@/feature/appointment/types";
export { DAYS, MONTHS, YEARS } from "@/shared/utilities/calendar";

export const APPOINTMENT_STATUS_FILTERS: {
  label: string;
  value: AppointmentFilterStatus;
}[] = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Completed", value: "completed" },
];

export type AppointmentServiceTab = "Services" | "Appointments";

export const APPOINTMENT_SERVICE_TABS: AppointmentServiceTab[] = ["Services", "Appointments"];
