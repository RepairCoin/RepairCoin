"use client";

import React from "react";
import { CheckCircle, Circle, Clock, ExternalLink, Package } from "lucide-react";
import { MockBooking, TimelineEvent, formatDateTime } from "../mockData";

interface BookingTimelineTabProps {
  booking: MockBooking;
}

const timelineSteps = [
  {
    type: 'submitted',
    title: 'Booking Submitted',
    description: 'Customer submitted the booking request'
  },
  {
    type: 'paid',
    title: 'Paid',
    description: 'Payment received'
  },
  {
    type: 'approved',
    title: 'Approval',
    description: 'This booking is waiting for your approval. Review details and respond to notify the customer.'
  },
  {
    type: 'scheduled',
    title: 'Scheduled',
    description: 'Service is scheduled — keep customer updated until completion.'
  },
  {
    type: 'completed',
    title: 'Completed',
    description: 'Service is done — receipts and RCN can be issued.'
  }
];

export const BookingTimelineTab: React.FC<BookingTimelineTabProps> = ({ booking }) => {
  // Get the event for each step if it exists
  const getEventForStep = (stepType: string): TimelineEvent | undefined => {
    return booking.timeline.find(e => e.type === stepType);
  };

  // Determine the status of each step based on booking status
  const getStepStatus = (stepType: string): 'completed' | 'current' | 'pending' => {
    const statusOrder = ['submitted', 'paid', 'approved', 'scheduled', 'completed'];
    const currentIndex = statusOrder.indexOf(booking.status === 'requested' ? 'submitted' : booking.status);
    const stepIndex = statusOrder.indexOf(stepType);

    if (booking.status === 'cancelled') {
      // For cancelled, only show submitted as completed
      const event = getEventForStep(stepType);
      return event ? 'completed' : 'pending';
    }

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="p-4 bg-[#0D0D0D] rounded-xl border border-gray-800">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5 text-gray-400" />
        <h4 className="text-white font-medium">Timeline</h4>
      </div>

      {/* Timeline */}
      <div className="relative">
        {timelineSteps.map((step, index) => {
          const status = getStepStatus(step.type);
          const event = getEventForStep(step.type);
          const isLast = index === timelineSteps.length - 1;

          return (
            <div key={step.type} className="relative">
              {/* Connector Line */}
              {!isLast && (
                <div
                  className={`absolute left-[11px] top-6 w-0.5 h-full ${
                    status === 'completed' ? 'bg-green-500' : 'bg-gray-700'
                  }`}
                />
              )}

              {/* Step Item */}
              <div className="flex gap-4 pb-6">
                {/* Icon */}
                <div className="flex-shrink-0 z-10">
                  {status === 'completed' ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  ) : status === 'current' ? (
                    <div className="w-6 h-6 rounded-full bg-[#1A1A1A] border-2 border-[#FFCC00] flex items-center justify-center">
                      <Circle className="w-2 h-2 text-[#FFCC00] fill-current" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#1A1A1A] border-2 border-gray-700 flex items-center justify-center">
                      <Circle className="w-2 h-2 text-gray-600" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h5 className={`font-medium ${
                    status === 'completed' ? 'text-green-400' :
                    status === 'current' ? 'text-[#FFCC00]' :
                    'text-gray-500'
                  }`}>
                    {step.title}
                  </h5>

                  {event ? (
                    <>
                      <p className="text-gray-400 text-sm mt-1">
                        {formatDateTime(event.timestamp)}
                      </p>
                      {event.metadata?.paymentMethod && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-gray-400 text-sm">
                            Via {event.metadata.paymentMethod}
                          </span>
                          {event.metadata.transactionId && (
                            <a
                              href={`https://dashboard.stripe.com/payments/${event.metadata.transactionId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 text-sm hover:text-blue-300 flex items-center gap-1"
                            >
                              (View Transaction)
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className={`text-sm mt-1 ${
                      status === 'current' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancelled Notice */}
      {booking.status === 'cancelled' && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm font-medium">
            This booking was cancelled
          </p>
        </div>
      )}
    </div>
  );
};
