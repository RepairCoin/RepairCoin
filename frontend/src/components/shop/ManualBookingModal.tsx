// frontend/src/components/shop/ManualBookingModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, User, Calendar as CalendarIcon, Clock, DollarSign, FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { appointmentsApi, CustomerSearchResult, TimeSlot } from '@/services/api/appointments';
import { servicesApi } from '@/services/api/services';
import { toast } from 'react-hot-toast';

interface ManualBookingModalProps {
  shopId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedService?: {
    serviceId: string;
    serviceName: string;
  };
  preSelectedDate?: string;
  preSelectedTime?: string;
}

interface Service {
  serviceId: string;
  serviceName: string;
  priceUsd: number;
  durationMinutes: number;
}

export const ManualBookingModal: React.FC<ManualBookingModalProps> = ({
  shopId,
  isOpen,
  onClose,
  onSuccess,
  preSelectedService,
  preSelectedDate,
  preSelectedTime
}) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  // New customer state
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  // Booking state
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(preSelectedService?.serviceId || '');
  const [bookingDate, setBookingDate] = useState(preSelectedDate || '');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(preSelectedTime || '');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'unpaid'>('paid');
  const [notes, setNotes] = useState('');

  // Loading states
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load services on mount
  useEffect(() => {
    if (isOpen) {
      loadServices();
    }
  }, [isOpen, shopId]);

  // Sync preSelectedDate when modal opens
  useEffect(() => {
    if (isOpen && preSelectedDate) {
      setBookingDate(preSelectedDate);
    }
  }, [isOpen, preSelectedDate]);

  // Load time slots when date and service change
  useEffect(() => {
    if (selectedServiceId && bookingDate) {
      loadTimeSlots();
    } else {
      setAvailableSlots([]);
      setSelectedTimeSlot('');
    }
  }, [selectedServiceId, bookingDate]);

  const loadServices = async () => {
    try {
      setLoadingServices(true);
      const response = await servicesApi.getShopServices(shopId);
      const data = response?.data || [];
      setServices(data.map((s: any) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        priceUsd: s.priceUsd,
        durationMinutes: s.durationMinutes || 60
      })));
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoadingServices(false);
    }
  };

  const loadTimeSlots = async () => {
    try {
      setLoadingSlots(true);
      const slots = await appointmentsApi.getAvailableTimeSlots(
        shopId,
        selectedServiceId,
        bookingDate
      );
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error loading time slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      toast.error('Please enter at least 2 characters to search');
      return;
    }

    try {
      setSearching(true);
      const results = await appointmentsApi.searchCustomers(shopId, searchQuery);
      setSearchResults(results);

      if (results.length === 0) {
        toast('No customers found. You can create a new customer.', { icon: 'ℹ️' });
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      toast.error('Failed to search customers');
    } finally {
      setSearching(false);
    }
  };

  const selectCustomer = (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    setSearchQuery('');
    setSearchResults([]);
    setShowNewCustomerForm(false);
  };

  const handleCreateNewCustomer = () => {
    setShowNewCustomerForm(true);
    setSearchResults([]);
    setSelectedCustomer(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedCustomer && !showNewCustomerForm) {
      toast.error('Please select or create a customer');
      return;
    }

    if (showNewCustomerForm) {
      if (!newCustomer.name.trim()) {
        toast.error('Customer name is required');
        return;
      }
      if (!newCustomer.address.trim()) {
        toast.error('Customer wallet address is required');
        return;
      }
      if (!newCustomer.email.trim() && !newCustomer.phone.trim()) {
        toast.error('Email or phone is required for new customers');
        return;
      }
    }

    if (!selectedServiceId) {
      toast.error('Please select a service');
      return;
    }

    if (!bookingDate) {
      toast.error('Please select a date');
      return;
    }

    if (!selectedTimeSlot) {
      toast.error('Please select a time slot');
      return;
    }

    try {
      setSubmitting(true);

      const selectedService = services.find(s => s.serviceId === selectedServiceId);
      if (!selectedService) {
        throw new Error('Selected service not found');
      }

      // Calculate end time based on service duration
      const [hours, minutes] = selectedTimeSlot.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(hours, minutes, 0);
      const endTime = new Date(startTime.getTime() + selectedService.durationMinutes * 60000);
      const bookingEndTime = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}:00`;

      const bookingData = showNewCustomerForm
        ? {
            customerAddress: newCustomer.address,
            customerEmail: newCustomer.email || undefined,
            customerName: newCustomer.name,
            customerPhone: newCustomer.phone || undefined,
            serviceId: selectedServiceId,
            bookingDate,
            bookingTimeSlot: `${selectedTimeSlot}:00`,
            bookingEndTime,
            paymentStatus,
            notes: notes || undefined,
            createNewCustomer: true
          }
        : {
            customerAddress: selectedCustomer!.address,
            customerEmail: selectedCustomer!.email || undefined,
            customerName: selectedCustomer!.name || undefined,
            customerPhone: selectedCustomer!.phone || undefined,
            serviceId: selectedServiceId,
            bookingDate,
            bookingTimeSlot: `${selectedTimeSlot}:00`,
            bookingEndTime,
            paymentStatus,
            notes: notes || undefined,
            createNewCustomer: false
          };

      await appointmentsApi.createManualBooking(shopId, bookingData);

      toast.success('Appointment booked successfully!');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error creating booking:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create booking';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset all state
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setShowNewCustomerForm(false);
    setNewCustomer({ name: '', email: '', phone: '', address: '' });
    setSelectedServiceId(preSelectedService?.serviceId || '');
    setBookingDate(preSelectedDate || '');
    setSelectedTimeSlot(preSelectedTime || '');
    setPaymentStatus('paid');
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  const selectedService = services.find(s => s.serviceId === selectedServiceId);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        className="bg-[#1A1A1A] border border-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#1A1A1A] border-b border-gray-800 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Book Appointment</h2>
            <p className="text-sm text-gray-400">Manually book an appointment for a customer</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Customer Selection */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-[#FFCC00]" />
              Customer
            </h3>

            {!selectedCustomer && !showNewCustomerForm && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search by name, email, phone, or address..."
                      className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-6 py-3 bg-[#FFCC00] text-black font-semibold rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50"
                  >
                    {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg divide-y divide-gray-800 max-h-60 overflow-y-auto">
                    {searchResults.map((customer) => (
                      <button
                        key={customer.address}
                        onClick={() => selectCustomer(customer)}
                        className="w-full p-4 text-left hover:bg-[#1A1A1A] transition-colors"
                      >
                        <div className="font-medium text-white">{customer.name || 'Unnamed Customer'}</div>
                        <div className="text-sm text-gray-400">{customer.email || customer.phone || 'No contact'}</div>
                        <div className="text-xs text-gray-500 mt-1 font-mono">{customer.address.substring(0, 20)}...</div>
                        {customer.noShowCount > 0 && (
                          <div className="text-xs text-yellow-500 mt-1">
                            ⚠️ {customer.noShowCount} no-show{customer.noShowCount > 1 ? 's' : ''} ({customer.noShowTier})
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleCreateNewCustomer}
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-800 text-white rounded-lg hover:bg-[#1A1A1A] transition-colors"
                >
                  + Create New Customer
                </button>
              </div>
            )}

            {selectedCustomer && (
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-white">{selectedCustomer.name || 'Unnamed Customer'}</div>
                    <div className="text-sm text-gray-400">{selectedCustomer.email || selectedCustomer.phone || 'No contact'}</div>
                    <div className="text-xs text-gray-500 mt-1 font-mono">{selectedCustomer.address}</div>
                    {selectedCustomer.noShowCount > 0 && (
                      <div className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {selectedCustomer.noShowCount} no-show{selectedCustomer.noShowCount > 1 ? 's' : ''} ({selectedCustomer.noShowTier})
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {showNewCustomerForm && (
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">New Customer</h4>
                  <button
                    onClick={() => setShowNewCustomerForm(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Customer Name *"
                  className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
                />

                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  placeholder="Email"
                  className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
                />

                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="Phone"
                  className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
                />

                <input
                  type="text"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  placeholder="Wallet Address (0x...) *"
                  className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] font-mono text-sm"
                />

                <p className="text-xs text-gray-500">* Required fields. Email or phone must be provided.</p>
              </div>
            )}
          </div>

          {/* Step 2: Service Selection */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FFCC00]" />
              Service
            </h3>

            {loadingServices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
              </div>
            ) : (
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
              >
                <option value="">Select a service...</option>
                {services.map((service) => (
                  <option key={service.serviceId} value={service.serviceId}>
                    {service.serviceName} - ${service.priceUsd.toFixed(2)} ({service.durationMinutes} min)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Step 3: Date & Time Selection */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#FFCC00]" />
              Date & Time
            </h3>

            <div className="space-y-3">
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
              />

              {loadingSlots && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
                  <span className="ml-2 text-gray-400">Loading available slots...</span>
                </div>
              )}

              {!loadingSlots && availableSlots.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedTimeSlot(slot.time)}
                      disabled={!slot.available}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedTimeSlot === slot.time
                          ? 'bg-[#FFCC00] text-black'
                          : slot.available
                          ? 'bg-[#0D0D0D] text-white border border-gray-800 hover:bg-[#1A1A1A]'
                          : 'bg-[#0D0D0D] text-gray-600 border border-gray-800 cursor-not-allowed'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}

              {!loadingSlots && selectedServiceId && bookingDate && availableSlots.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  No available time slots for this date
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Payment Status */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#FFCC00]" />
              Payment Status
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {(['paid', 'pending', 'unpaid'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setPaymentStatus(status)}
                  className={`px-4 py-3 rounded-lg font-medium capitalize transition-colors ${
                    paymentStatus === status
                      ? 'bg-[#FFCC00] text-black'
                      : 'bg-[#0D0D0D] text-white border border-gray-800 hover:bg-[#1A1A1A]'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {selectedService && (
              <div className="mt-3 p-3 bg-[#0D0D0D] border border-gray-800 rounded-lg">
                <div className="text-sm text-gray-400">Total Amount:</div>
                <div className="text-2xl font-bold text-white">${selectedService.priceUsd.toFixed(2)}</div>
              </div>
            )}
          </div>

          {/* Step 5: Notes (Optional) */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FFCC00]" />
              Notes (Optional)
            </h3>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this booking..."
              rows={3}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#1A1A1A] border-t border-gray-800 p-6 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-6 py-3 bg-[#0D0D0D] text-white font-semibold rounded-lg border border-gray-800 hover:bg-[#1A1A1A] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-3 bg-[#FFCC00] text-black font-semibold rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Booking...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Book Appointment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
