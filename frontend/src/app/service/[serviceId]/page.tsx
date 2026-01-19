import { ServiceCheckoutClient } from '@/components/service/ServiceCheckoutClient';

interface ServicePageProps {
  params: Promise<{
    serviceId: string;
  }>;
}

export default async function ServicePage({ params }: ServicePageProps) {
  const resolvedParams = await params;

  return <ServiceCheckoutClient serviceId={resolvedParams.serviceId} />;
}
