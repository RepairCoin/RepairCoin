import { ShopProfileClient } from "@/components/customer/ShopProfileClient";

export default function ShopProfilePage({ params }: { params: { shopId: string } }) {
  return <ShopProfileClient shopId={params.shopId} />;
}
