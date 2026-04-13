import apiClient from "@/shared/utilities/axios";

interface BugReportPayload {
  category: string;
  title: string;
  description: string;
}

interface BugReportResponse {
  success: boolean;
  data: {
    id: number;
    message: string;
  };
}

export const bugReportApi = {
  submit: (payload: BugReportPayload): Promise<BugReportResponse> =>
    apiClient.post("/bug-reports", payload),
};
