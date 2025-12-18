import { ShopProfileClient } from "@/components/customer/ShopProfileClient";

export default async function ShopProfilePage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <ShopProfileClient shopId={shopId} />;
}
