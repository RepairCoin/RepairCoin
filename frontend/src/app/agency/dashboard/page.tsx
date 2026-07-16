import { redirect } from "next/navigation";

// The agency dashboard now lives as a tab inside the shop dashboard (/shop?tab=agency),
// consistent with every other shop feature. This route is kept as a redirect so existing
// links and bookmarks still resolve.
export default function AgencyDashboardRedirect() {
  redirect("/shop?tab=agency");
}
