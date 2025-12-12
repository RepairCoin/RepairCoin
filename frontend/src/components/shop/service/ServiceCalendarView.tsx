"use client";

import React from 'react';
import { AppointmentCalendar } from '@/components/shop/AppointmentCalendar';
import { ShopService } from '@/services/api/services';

interface ServiceCalendarViewProps {
  serviceId: string;
  service: ShopService;
}

export const ServiceCalendarView: React.FC<ServiceCalendarViewProps> = ({ serviceId, service }) => {
  return (
    <AppointmentCalendar
      serviceId={serviceId}
      serviceName={service.serviceName}
    />
  );
};
