import { Metadata } from 'next';
import { ShopServiceWithShopInfo } from '@/services/api/services';
import { ServicePageClient } from './ServicePageClient';

// Server-side function to fetch service details for meta tags
async function getServiceForMeta(serviceId: string): Promise<ShopServiceWithShopInfo | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const response = await fetch(`${apiUrl}/services/${serviceId}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Service fetch failed:', response.status, response.statusText);
      return null;
    }

    const result = await response.json();
    return result.data || result || null;
  } catch (error) {
    console.error('Error fetching service for meta:', error);
    return null;
  }
}

// Format price for display
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

// Generate dynamic metadata for Open Graph
export async function generateMetadata({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}): Promise<Metadata> {
  const { serviceId } = await params;
  const service = await getServiceForMeta(serviceId);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repaircoin.ai';

  // Default metadata if service not found
  if (!service) {
    return {
      title: 'Service Not Found | RepairCoin',
      description: 'The requested service could not be found on RepairCoin.',
      openGraph: {
        title: 'Service Not Found | RepairCoin',
        description: 'The requested service could not be found on RepairCoin.',
        url: `${baseUrl}/services/${serviceId}`,
        siteName: 'RepairCoin',
        type: 'website',
      },
    };
  }

  const title = `${service.serviceName} - ${formatPrice(service.priceUsd)} | RepairCoin`;
  const shopName = service.companyName || service.shopName || 'RepairCoin Partner';
  const description = service.description
    ? `${service.description.substring(0, 150)}${service.description.length > 150 ? '...' : ''}`
    : `Book ${service.serviceName} at ${shopName}. Earn RCN rewards on RepairCoin!`;

  // Use service image or fallback to default OG image
  // For services without images, use the RepairCoin logo as fallback
  const imageUrl = service.imageUrl || `${baseUrl}/img/favicon-logo.png`;
  const pageUrl = `${baseUrl}/services/${serviceId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'RepairCoin',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: service.serviceName,
        },
      ],
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      site: '@RepairCoin',
      creator: '@RepairCoin',
    },
    other: {
      'og:price:amount': service.priceUsd.toString(),
      'og:price:currency': 'USD',
    },
  };
}

// Service page component - renders content for crawlers, redirects users
export default async function ServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const service = await getServiceForMeta(serviceId);

  // Pass service data to client component for rendering and redirect
  return <ServicePageClient serviceId={serviceId} service={service} />;
}
