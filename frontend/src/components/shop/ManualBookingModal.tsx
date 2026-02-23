// frontend/src/components/shop/ManualBookingModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, User, Calendar as CalendarIcon, Clock, DollarSign, FileText, Loader2, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';
import { appointmentsApi, CustomerSearchResult, TimeSlot, TimeSlotConfig, ManualBookingResponse } from '@/services/api/appointments';
import { servicesApi } from '@/services/api/services';
import { toast } from 'react-hot-toast';
import { DateAvailabilityPicker } from '@/components/customer/DateAvailabilityPicker';
import { QRCodeSVG } from 'qrcode.react';

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

  // New customer state (no address - will be auto-generated as placeholder)
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: ''
  });

  // Generate placeholder wallet address for manual booking customers
  // Format: 0xMANUAL + 34 random hex chars = 42 chars total (valid address format)
  const generatePlaceholderWallet = (): string => {
    const randomHex = Array.from({ length: 34 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    return `0xMANUAL${randomHex}`;
  };

  // Check if an address is a placeholder (for display purposes)
  const isPlaceholderWallet = (address: string): boolean => {
    return address?.toLowerCase().startsWith('0xmanual');
  };

  // Booking state
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(preSelectedService?.serviceId || '');
  const [bookingDate, setBookingDate] = useState(preSelectedDate || '');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(preSelectedTime || '');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'unpaid' | 'send_link' | 'qr_code'>('paid');

  // QR Code modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrPaymentLink, setQrPaymentLink] = useState<string | null>(null);
  const [qrBookingDetails, setQrBookingDetails] = useState<ManualBookingResponse | null>(null);
  const [notes, setNotes] = useState('');

  // Loading states
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Time slot configuration for the shop
  const [timeSlotConfig, setTimeSlotConfig] = useState<TimeSlotConfig | null>(null);

  // Load services and time slot config on mount
  useEffect(() => {
    if (isOpen) {
      loadServices();
      loadTimeSlotConfig();
    }
  }, [isOpen, shopId]);

  const loadTimeSlotConfig = async () => {
    try {
      const config = await appointmentsApi.getPublicTimeSlotConfig(shopId);
      setTimeSlotConfig(config);
    } catch (error) {
      console.error('Error loading time slot config:', error);
    }
  };

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
      const mappedServices = data.map((s: any) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        priceUsd: s.priceUsd,
        durationMinutes: s.durationMinutes || 60
      }));
      setServices(mappedServices);

      // Auto-select first service if none selected (so time slots load when date is clicked)
      if (!selectedServiceId && mappedServices.length > 0) {
        setSelectedServiceId(mappedServices[0].serviceId);
      }
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

  // Format time from HH:MM to 12-hour format
  const formatTime12Hour = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
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

  // Validation helpers
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidWalletAddress = (address: string): boolean => {
    // Ethereum wallet address: 0x followed by 40 hex characters
    const walletRegex = /^0x[a-fA-F0-9]{40}$/;
    return walletRegex.test(address);
  };

  const isValidPhone = (phone: string): boolean => {
    // Basic phone validation: at least 10 digits, allows +, -, (), spaces
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 10;
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
      // Wallet address is no longer required - will be auto-generated as placeholder
      if (!newCustomer.email.trim() && !newCustomer.phone.trim()) {
        toast.error('Email or phone is required for new customers');
        return;
      }
      if (newCustomer.email.trim() && !isValidEmail(newCustomer.email.trim())) {
        toast.error('Please enter a valid email address');
        return;
      }
      if (newCustomer.phone.trim() && !isValidPhone(newCustomer.phone.trim())) {
        toast.error('Please enter a valid phone number (at least 10 digits)');
        return;
      }
    }

    // Validate email for send_link payment status
    if (paymentStatus === 'send_link') {
      const customerEmail = showNewCustomerForm ? newCustomer.email : selectedCustomer?.email;
      if (!customerEmail?.trim()) {
        toast.error('Customer email is required to send a payment link');
        return;
      }
      if (!isValidEmail(customerEmail.trim())) {
        toast.error('Please enter a valid email address to send payment link');
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

      // Generate placeholder wallet for new customers (prevents collision with real wallets)
      const placeholderWallet = generatePlaceholderWallet();

      const bookingData = showNewCustomerForm
        ? {
            customerAddress: placeholderWallet, // Auto-generated placeholder
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

      const response = await appointmentsApi.createManualBooking(shopId, bookingData);

      // If QR code payment, show QR modal instead of closing
      if (paymentStatus === 'qr_code' && response.paymentLink) {
        setQrPaymentLink(response.paymentLink);
        setQrBookingDetails(response);
        setShowQRModal(true);
        toast.success('Appointment created! Show QR code to customer.');
        onSuccess();
      } else {
        toast.success('Appointment booked successfully!');
        onSuccess();
        handleClose();
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create booking';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setQrPaymentLink(null);
    setQrBookingDetails(null);
    handleClose();
  };

  const handleClose = () => {
    // Reset all state
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setShowNewCustomerForm(false);
    setNewCustomer({ name: '', email: '', phone: '' });
    setSelectedServiceId(preSelectedService?.serviceId || '');
    setBookingDate(preSelectedDate || '');
    setSelectedTimeSlot(preSelectedTime || '');
    setPaymentStatus('paid');
    setNotes('');
    setShowQRModal(false);
    setQrPaymentLink(null);
    setQrBookingDetails(null);
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

                <p className="text-xs text-gray-500">* Name required. Email or phone must be provided.</p>

                {/* Info about placeholder wallet */}
                <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400">
                    💡 A temporary account will be created for this customer. When they sign up with their real wallet, they can claim their booking history using their email or phone.
                  </p>
                </div>
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
              {/* Visual Calendar Date Picker */}
              <DateAvailabilityPicker
                shopId={shopId}
                selectedDate={bookingDate ? new Date(bookingDate + 'T00:00:00') : null}
                onDateSelect={(date) => {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  setBookingDate(`${year}-${month}-${day}`);
                }}
                maxAdvanceDays={timeSlotConfig?.bookingAdvanceDays || 60}
                minBookingHours={timeSlotConfig?.minBookingHours || 0}
                allowWeekendBooking={timeSlotConfig?.allowWeekendBooking ?? true}
              />

              {loadingSlots && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
                  <span className="ml-2 text-gray-400">Loading available slots...</span>
                </div>
              )}

              {!loadingSlots && availableSlots.length > 0 && (
                <>
                  <p className="text-sm text-gray-400 mb-2">Select a time slot:</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedTimeSlot(slot.time)}
                        disabled={!slot.available}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          selectedTimeSlot === slot.time
                            ? 'bg-[#FFCC00] text-black ring-2 ring-[#FFCC00] ring-offset-2 ring-offset-[#1A1A1A]'
                            : slot.available
                            ? 'bg-[#0D0D0D] text-white border border-gray-800 hover:border-[#FFCC00] hover:bg-[#1A1A1A]'
                            : 'bg-[#0A0A0A] text-gray-600 border border-gray-900 cursor-not-allowed'
                        }`}
                      >
                        {formatTime12Hour(slot.time)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {!loadingSlots && selectedServiceId && bookingDate && availableSlots.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  No available time slots for this date
                </div>
              )}

              {/* Prompt to select service first if date is selected but no service */}
              {!selectedServiceId && bookingDate && (
                <div className="text-center py-4 text-amber-400 bg-amber-400/10 rounded-lg border border-amber-400/30">
                  <p className="text-sm">Please select a service above to see available time slots</p>
                </div>
              )}

              {/* Show selected time confirmation */}
              {selectedTimeSlot && (
                <div className="mt-3 p-3 bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-lg">
                  <p className="text-sm text-[#FFCC00]">
                    Selected time: <span className="font-semibold">{formatTime12Hour(selectedTimeSlot)}</span>
                  </p>
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

            {/* First row: 3 buttons */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button
                onClick={() => setPaymentStatus('paid')}
                className={`px-3 py-3 rounded-lg font-medium transition-colors ${
                  paymentStatus === 'paid'
                    ? 'bg-green-500 text-white'
                    : 'bg-[#0D0D0D] text-white border border-gray-800 hover:bg-[#1A1A1A]'
                }`}
              >
                <div className="text-sm font-semibold">Paid</div>
                <div className="text-xs opacity-70">Already collected</div>
              </button>
              <button
                onClick={() => setPaymentStatus('pending')}
                className={`px-3 py-3 rounded-lg font-medium transition-colors ${
                  paymentStatus === 'pending'
                    ? 'bg-amber-500 text-white'
                    : 'bg-[#0D0D0D] text-white border border-gray-800 hover:bg-[#1A1A1A]'
                }`}
              >
                <div className="text-sm font-semibold">Pending</div>
                <div className="text-xs opacity-70">Pay at arrival</div>
              </button>
              <button
                onClick={() => setPaymentStatus('unpaid')}
                className={`px-3 py-3 rounded-lg font-medium transition-colors ${
                  paymentStatus === 'unpaid'
                    ? 'bg-gray-500 text-white'
                    : 'bg-[#0D0D0D] text-white border border-gray-800 hover:bg-[#1A1A1A]'
                }`}
              >
                <div className="text-sm font-semibold">Unpaid</div>
                <div className="text-xs opacity-70">No payment</div>
              </button>
            </div>

            {/* Second row: 2 buttons for digital payment */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentStatus('qr_code')}
                className={`px-3 py-3 rounded-lg font-medium transition-colors ${
                  paymentStatus === 'qr_code'
                    ? 'bg-purple-500 text-white'
                    : 'bg-[#0D0D0D] text-white border border-gray-800 hover:bg-[#1A1A1A]'
                }`}
              >
                <div className="text-sm font-semibold flex items-center justify-center gap-1">
                  <Smartphone className="w-4 h-4" />
                  QR Code
                </div>
                <div className="text-xs opacity-70">Walk-in scan & pay</div>
              </button>
              <button
                onClick={() => setPaymentStatus('send_link')}
                className={`px-3 py-3 rounded-lg font-medium transition-colors ${
                  paymentStatus === 'send_link'
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#0D0D0D] text-white border border-gray-800 hover:bg-[#1A1A1A]'
                }`}
              >
                <div className="text-sm font-semibold">Send Link</div>
                <div className="text-xs opacity-70">Email payment link</div>
              </button>
            </div>

            {/* Warning for send_link if no email */}
            {paymentStatus === 'send_link' && !selectedCustomer?.email && !newCustomer.email && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">Customer email is required to send a payment link</p>
              </div>
            )}

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

      {/* QR Code Payment Modal */}
      {showQRModal && qrPaymentLink && qrBookingDetails && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={handleCloseQRModal}>
          <div
            className="bg-[#1A1A1A] border border-gray-800 rounded-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* QR Modal Header */}
            <div className="border-b border-gray-800 p-6 text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Smartphone className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Scan to Pay</h3>
              <p className="text-sm text-gray-400">Customer scans QR code with their phone</p>
            </div>

            {/* QR Code */}
            <div className="p-6 flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl mb-4">
                <QRCodeSVG
                  value={qrPaymentLink}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Booking Details */}
              <div className="w-full bg-[#0D0D0D] border border-gray-800 rounded-lg p-4 mb-4">
                <div className="text-center mb-3">
                  <div className="text-3xl font-bold text-[#FFCC00]">
                    ${qrBookingDetails.totalAmount.toFixed(2)}
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Service:</span>
                    <span className="text-white">{qrBookingDetails.serviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Date:</span>
                    <span className="text-white">{qrBookingDetails.bookingDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Time:</span>
                    <span className="text-white">{formatTime12Hour(qrBookingDetails.bookingTimeSlot.substring(0, 5))}</span>
                  </div>
                </div>
              </div>

              {/* Expiry Warning */}
              <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-400 text-center">
                  ⏰ This QR code expires in 24 hours
                </p>
              </div>

              {/* Status Info */}
              <div className="text-center text-sm text-gray-400 mb-4">
                <p>Appointment will auto-confirm when payment is complete</p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-800 p-4">
              <button
                onClick={handleCloseQRModal}
                className="w-full px-6 py-3 bg-[#FFCC00] text-black font-semibold rounded-lg hover:bg-[#FFD700] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
