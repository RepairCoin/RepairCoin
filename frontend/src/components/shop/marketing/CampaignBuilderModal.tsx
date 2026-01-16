"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Send,
  Save,
  Trash2,
  GripVertical,
  Type,
  Image,
  Square,
  Minus,
  Gift,
  Users,
  Mail,
  Bell,
  Check,
  Wrench,
  ChevronUp,
  ChevronDown,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MarketingCampaign,
  MarketingTemplate,
  CreateCampaignData,
  createCampaign,
  updateCampaign,
  sendCampaign,
  getShopCustomers,
  ShopCustomer,
} from "@/services/api/marketing";
import { ShopService, getShopServices } from "@/services/api/services";
import apiClient from "@/services/api/client";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

interface PromoCode {
  id: number;
  code: string;
  name: string;
  description?: string;
  bonus_type: "fixed" | "percentage";
  bonus_value: number;
  max_bonus?: number;
  start_date: string;
  end_date: string;
  total_usage_limit?: number;
  per_customer_limit: number;
  times_used: number;
  total_bonus_issued: number;
  is_active: boolean;
}

interface CampaignBuilderModalProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  shopId: string;
  shopName?: string;
  campaignType: 'announce_service' | 'offer_coupon' | 'newsletter' | 'custom';
  existingCampaign?: MarketingCampaign | null;
  template?: MarketingTemplate | null;
  viewOnly?: boolean;
}

interface DesignBlock {
  id: string;
  type: 'headline' | 'text' | 'button' | 'image' | 'coupon' | 'service_card' | 'divider' | 'spacer';
  content?: string;
  style?: Record<string, string>;
  src?: string;
  href?: string;
  serviceId?: string;
  serviceName?: string;
  servicePrice?: number;
  serviceImage?: string;
}

const defaultBlocks: Record<string, DesignBlock[]> = {
  offer_coupon: [
    { id: '1', type: 'headline', content: 'Thanks for your support!', style: { fontSize: '24px', textAlign: 'center', color: '#111827' } },
    { id: '2', type: 'text', content: 'As a small token of appreciation, below is a reward that can be used during your next visit. Hope you enjoy it!', style: { textAlign: 'center', color: '#666666', fontSize: '14px' } },
    { id: '3', type: 'coupon', style: { backgroundColor: '#10B981' } },
    { id: '4', type: 'text', content: 'Valid in-store or online. May be canceled at any time.', style: { fontSize: '12px', textAlign: 'center', color: '#999999' } },
  ],
  announce_service: [
    { id: '1', type: 'headline', content: 'Check out our new services!', style: { fontSize: '24px', textAlign: 'center', color: '#111827' } },
    { id: '2', type: 'text', content: 'We are excited to show you these new services. Come on in to check them out, we think you will love them as much as we do.', style: { textAlign: 'center', color: '#666666', fontSize: '14px' } },
    { id: '3', type: 'service_card', style: { backgroundColor: '#10B981' } },
    { id: '4', type: 'button', content: 'Book Now', style: { backgroundColor: '#eab308', textColor: '#000000' } },
  ],
  newsletter: [
    { id: '1', type: 'headline', content: 'Monthly Update', style: { fontSize: '24px', textAlign: 'center', color: '#111827' } },
    { id: '2', type: 'text', content: 'Here is what is happening at our shop this month...', style: { color: '#666666', fontSize: '14px' } },
    { id: '3', type: 'divider' },
    { id: '4', type: 'text', content: 'Add your newsletter content here.', style: { color: '#333333', fontSize: '14px' } },
  ],
  custom: [
    { id: '1', type: 'headline', content: 'Your Message Here', style: { fontSize: '24px', textAlign: 'center', color: '#111827' } },
    { id: '2', type: 'text', content: 'Add your custom message content...', style: { color: '#666666', fontSize: '14px' } },
  ],
};

// Color presets for quick selection
const colorPresets = [
  '#000000', '#333333', '#666666', '#999999', '#FFFFFF',
  '#10B981', '#059669', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#EF4444', '#F97316', '#EAB308',
];

// Sortable Block Item Component
function SortableBlockItem({
  block,
  isSelected,
  onSelect,
  onDelete,
}: {
  block: DesignBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'bg-yellow-500/20 border border-yellow-500' : 'bg-gray-800 hover:bg-gray-700/50'
      }`}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 hover:bg-gray-600 rounded cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-gray-500" />
      </button>
      <span className="flex-1 text-white text-sm truncate">
        {block.type.charAt(0).toUpperCase() + block.type.slice(1)}
        {block.content && `: ${block.content.substring(0, 15)}...`}
        {block.type === 'service_card' && block.serviceName && `: ${block.serviceName}`}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 hover:bg-red-500/20 rounded"
      >
        <Trash2 className="w-3 h-3 text-red-400" />
      </button>
    </div>
  );
}

export function CampaignBuilderModal({
  open,
  onClose,
  shopId,
  shopName = 'Your Shop',
  campaignType,
  existingCampaign,
  template,
  viewOnly = false,
}: CampaignBuilderModalProps) {
  const [step, setStep] = useState<'design' | 'audience' | 'delivery'>('design');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('blocks');

  // Services for service_card block
  const [services, setServices] = useState<ShopService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Promo codes for coupon block
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loadingPromoCodes, setLoadingPromoCodes] = useState(false);
  const [selectedPromoCodeId, setSelectedPromoCodeId] = useState<number | null>(existingCampaign?.promoCodeId || null);

  // Form state
  const [name, setName] = useState(existingCampaign?.name || '');
  const [subject, setSubject] = useState(existingCampaign?.subject || '');
  const [blocks, setBlocks] = useState<DesignBlock[]>([]);
  // audienceType is always 'select_customers' now since we use the customer list approach
  const [deliveryMethod, setDeliveryMethod] = useState<string>(existingCampaign?.deliveryMethod || 'in_app');
  const [couponValue, setCouponValue] = useState<string>(existingCampaign?.couponValue?.toString() || '5');
  const [couponType, setCouponType] = useState<string>(existingCampaign?.couponType || 'fixed');
  const [couponExpiry, setCouponExpiry] = useState<string>('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [headerEnabled, setHeaderEnabled] = useState(true);
  const [footerSocial, setFooterSocial] = useState(true);

  // Customer selection state
  const [customers, setCustomers] = useState<ShopCustomer[]>([]);
  const [allCustomerAddresses, setAllCustomerAddresses] = useState<string[]>([]); // Track all addresses for "select all"
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [customerTotalPages, setCustomerTotalPages] = useState(1);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [customerFilter, setCustomerFilter] = useState<'all' | 'most_transactions' | 'active'>('all');
  const [customerSort, setCustomerSort] = useState<'recent' | 'transactions_high' | 'transactions_low'>('recent');
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load shop services
  useEffect(() => {
    const loadServices = async () => {
      setLoadingServices(true);
      try {
        const result = await getShopServices(shopId, { limit: 100 });
        console.log('Services API response:', result);

        // Handle different response structures
        let servicesList: ShopService[] = [];
        if (result) {
          // Response could be { success, data: [...], pagination } or { items: [...] }
          if (Array.isArray((result as any).data)) {
            servicesList = (result as any).data;
          } else if (result.items && Array.isArray(result.items)) {
            servicesList = result.items;
          } else if (Array.isArray(result)) {
            servicesList = result as unknown as ShopService[];
          }
        }

        // Filter to only active services
        setServices(servicesList.filter(s => s.active));
      } catch (error) {
        console.error('Error loading services:', error);
        setServices([]);
      } finally {
        setLoadingServices(false);
      }
    };
    loadServices();
  }, [shopId]);

  // Load shop promo codes
  useEffect(() => {
    const loadPromoCodes = async () => {
      setLoadingPromoCodes(true);
      try {
        const response = await apiClient.get(`/shops/${shopId}/promo-codes`);
        const codes = response.data || [];
        // Filter to only active promo codes that haven't expired
        const now = new Date();
        const activeCodes = codes.filter((pc: PromoCode) => {
          if (!pc.is_active) return false;
          const endDate = new Date(pc.end_date);
          if (now > endDate) return false;
          if (pc.total_usage_limit && pc.times_used >= pc.total_usage_limit) return false;
          return true;
        });
        setPromoCodes(activeCodes);
      } catch (error) {
        console.error('Error loading promo codes:', error);
        setPromoCodes([]);
      } finally {
        setLoadingPromoCodes(false);
      }
    };
    loadPromoCodes();
  }, [shopId]);

  useEffect(() => {
    // Helper to ensure blocks have unique IDs
    const ensureUniqueIds = (blocks: DesignBlock[]): DesignBlock[] => {
      return blocks.map((block, index) => ({
        ...block,
        id: block.id || `block-${Date.now()}-${index}`,
      }));
    };

    // Initialize blocks from existing campaign, template, or defaults
    if (existingCampaign?.designContent?.blocks) {
      setBlocks(ensureUniqueIds(existingCampaign.designContent.blocks));
    } else if (template?.designContent?.blocks) {
      // Generate new unique IDs for template blocks to avoid conflicts
      const templateBlocks = template.designContent.blocks.map((block: DesignBlock, index: number) => ({
        ...block,
        id: `template-${Date.now()}-${index}`,
      }));
      setBlocks(templateBlocks);
    } else {
      // Generate new unique IDs for default blocks
      const defaults = defaultBlocks[campaignType] || defaultBlocks.custom;
      const blocksWithUniqueIds = defaults.map((block, index) => ({
        ...block,
        id: `default-${Date.now()}-${index}`,
      }));
      setBlocks(blocksWithUniqueIds);
    }

    // Set default subject based on campaign type
    if (!existingCampaign?.subject) {
      const subjects: Record<string, string> = {
        offer_coupon: `A Small Thank You from ${shopName}`,
        announce_service: `See the newest services from ${shopName}`,
        newsletter: `Updates from ${shopName}`,
        custom: `Message from ${shopName}`,
      };
      setSubject(subjects[campaignType] || subjects.custom);
    }

    // Set default name
    if (!existingCampaign?.name) {
      const names: Record<string, string> = {
        offer_coupon: 'Thank You Coupon',
        announce_service: 'New Service Announcement',
        newsletter: 'Monthly Newsletter',
        custom: 'Custom Campaign',
      };
      setName(names[campaignType] || names.custom);
    }

    // Set default coupon expiry (60 days from now)
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 60);
    setCouponExpiry(defaultExpiry.toISOString().split('T')[0]);
  }, [campaignType, existingCampaign, template, shopName]);

  // Load customers when step changes to audience
  useEffect(() => {
    if (step === 'audience') {
      loadCustomers();
    }
  }, [step, shopId, customerSearch, customerPage, customerFilter, customerSort]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const result = await getShopCustomers(shopId, customerPage, 20, customerSearch || undefined);
      let processedCustomers = [...result.customers];

      // Apply filter
      if (customerFilter === 'most_transactions') {
        // Filter to customers with transactions (visitCount > 0)
        processedCustomers = processedCustomers.filter(c => (c.visitCount || 0) > 0);
        // Sort by transaction count
        processedCustomers.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
      } else if (customerFilter === 'active') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        processedCustomers = processedCustomers.filter(c =>
          c.lastVisit && new Date(c.lastVisit) >= thirtyDaysAgo
        );
      }

      // Apply sort (only if not already sorted by filter)
      if (customerFilter !== 'most_transactions') {
        if (customerSort === 'transactions_high') {
          processedCustomers.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
        } else if (customerSort === 'transactions_low') {
          processedCustomers.sort((a, b) => (a.visitCount || 0) - (b.visitCount || 0));
        }
      }

      setCustomers(processedCustomers);
      setCustomerTotalPages(result.totalPages);
      setCustomerTotal(result.total);

      // On first load, select all customers by default
      if (!initialLoadDone && result.customers.length > 0) {
        const allAddresses = result.customers.map(c => c.walletAddress);
        setAllCustomerAddresses(allAddresses);
        setSelectedCustomers(new Set(allAddresses));
        setInitialLoadDone(true);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleToggleCustomer = (walletAddress: string) => {
    setSelectedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(walletAddress)) {
        newSet.delete(walletAddress);
      } else {
        newSet.add(walletAddress);
      }
      return newSet;
    });
  };

  const handleSelectAllCustomers = () => {
    // Select all customers (from all pages)
    if (allCustomerAddresses.length > 0) {
      setSelectedCustomers(new Set(allCustomerAddresses));
    } else {
      // Fallback to visible customers
      setSelectedCustomers(new Set(customers.map(c => c.walletAddress)));
    }
  };

  const handleDeselectAllCustomers = () => {
    setSelectedCustomers(new Set());
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAddBlock = (type: DesignBlock['type']) => {
    const newBlock: DesignBlock = {
      id: Date.now().toString(),
      type,
      content: type === 'headline' ? 'New Headline' :
               type === 'text' ? 'New text block...' :
               type === 'button' ? 'Click Here' : undefined,
      style: type === 'headline' ? { fontSize: '24px', textAlign: 'center', color: '#111827' } :
             type === 'text' ? { fontSize: '14px', color: '#666666' } :
             type === 'button' ? { backgroundColor: '#eab308', textColor: '#000000' } :
             type === 'coupon' ? { backgroundColor: '#10B981' } :
             type === 'service_card' ? { backgroundColor: '#10B981' } :
             type === 'spacer' ? { height: '20px' } : {},
    };
    setBlocks([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setActiveTab('style');
  };

  const handleUpdateBlock = useCallback((id: string, updates: Partial<DesignBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const handleUpdateBlockStyle = useCallback((id: string, styleUpdates: Record<string, string>) => {
    setBlocks(prev => prev.map(b => {
      if (b.id === id) {
        return { ...b, style: { ...b.style, ...styleUpdates } };
      }
      return b;
    }));
  }, []);

  const handleDeleteBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
    setSelectedBlockId(null);
    setActiveTab('blocks'); // Go back to blocks tab after deletion
  };

  const handleSelectService = (blockId: string, serviceId: string) => {
    const service = services.find(s => s.serviceId === serviceId);
    if (service) {
      // Update the service card block
      handleUpdateBlock(blockId, {
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        servicePrice: service.priceUsd,
        serviceImage: service.imageUrl,
      });

      // Also update any button blocks with the service URL
      const serviceUrl = `${window.location.origin}/customer?tab=marketplace&service=${service.serviceId}`;
      setBlocks(prevBlocks =>
        prevBlocks.map(block =>
          block.type === 'button'
            ? { ...block, href: serviceUrl }
            : block
        )
      );
    }
  };

  const handleSelectPromoCode = (promoCodeId: number) => {
    const promoCode = promoCodes.find(pc => pc.id === promoCodeId);
    if (promoCode) {
      setSelectedPromoCodeId(promoCode.id);
      setCouponValue(promoCode.bonus_value.toString());
      setCouponType(promoCode.bonus_type);
      setCouponExpiry(new Date(promoCode.end_date).toISOString().split('T')[0]);
    }
  };

  const buildDesignContent = () => ({
    header: {
      enabled: headerEnabled,
      showLogo: true,
      backgroundColor: '#1a1a2e',
    },
    blocks,
    footer: {
      showSocial: footerSocial,
      showUnsubscribe: true,
    },
  });

  const handleSave = async (andSend = false) => {
    if (!name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    try {
      setSaving(true);

      // Extract serviceId from service_card block if present
      const serviceCardBlock = blocks.find(b => b.type === 'service_card' && b.serviceId);
      const selectedServiceId = serviceCardBlock?.serviceId;

      // Always use select_customers since we're using the customer list approach
      const campaignData: CreateCampaignData = {
        name,
        campaignType,
        subject,
        designContent: buildDesignContent(),
        audienceType: 'select_customers',
        deliveryMethod: deliveryMethod as any,
        audienceFilters: { selectedAddresses: Array.from(selectedCustomers) },
        ...(selectedServiceId && { serviceId: selectedServiceId }),
      };

      if (campaignType === 'offer_coupon' && selectedPromoCodeId) {
        const selectedPC = promoCodes.find(pc => pc.id === selectedPromoCodeId);
        if (selectedPC) {
          campaignData.promoCodeId = selectedPromoCodeId;
          campaignData.couponValue = selectedPC.bonus_value;
          campaignData.couponType = selectedPC.bonus_type as 'fixed' | 'percentage';
          campaignData.couponExpiresAt = new Date(selectedPC.end_date).toISOString();
        }
      }

      let savedCampaign: MarketingCampaign;

      if (existingCampaign) {
        savedCampaign = await updateCampaign(existingCampaign.id, campaignData);
        toast.success('Campaign saved');
      } else {
        savedCampaign = await createCampaign(shopId, campaignData);
        toast.success('Campaign created');
      }

      if (andSend) {
        setSending(true);
        const result = await sendCampaign(savedCampaign.id);
        toast.success(`Campaign sent to ${result.totalRecipients} recipients!`);
      }

      onClose(true);
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      toast.error(error.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const renderPreview = () => {
    return (
      <div className="bg-white rounded-lg overflow-hidden shadow-lg max-w-md mx-auto">
        {/* Subject line */}
        <div className="bg-gray-100 px-4 py-2 border-b">
          <span className="text-gray-500 text-sm">Subject: </span>
          <span className="text-gray-800 text-sm">{subject}</span>
        </div>

        {/* Header */}
        {headerEnabled && (
          <div className="bg-[#1a1a2e] p-6 text-center">
            <img src="/img/landing/repaircoin-icon.png" alt="RepairCoin" className="w-12 h-12 mx-auto mb-3" />
            <h1 className="text-white text-lg font-semibold">{shopName}</h1>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4">
          {blocks.map((block) => {
            const isSelected = selectedBlockId === block.id;
            const outlineClass = viewOnly ? '' : (isSelected ? 'outline outline-2 outline-blue-500' : 'hover:outline hover:outline-blue-300');
            const cursorClass = viewOnly ? '' : 'cursor-pointer';

            switch (block.type) {
              case 'headline':
                return (
                  <h2
                    key={block.id}
                    className={`${cursorClass} rounded ${outlineClass}`}
                    style={{
                      fontSize: block.style?.fontSize || '24px',
                      fontWeight: 'bold',
                      textAlign: (block.style?.textAlign as any) || 'center',
                      color: block.style?.color || '#111827',
                    }}
                    onClick={() => { if (!viewOnly) { setSelectedBlockId(block.id); setActiveTab('style'); } }}
                  >
                    {block.content}
                  </h2>
                );

              case 'text':
                return (
                  <div
                    key={block.id}
                    className={`${cursorClass} rounded prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:my-1 [&_a]:text-blue-500 [&_a]:underline ${outlineClass}`}
                    style={{
                      fontSize: block.style?.fontSize || '14px',
                      lineHeight: '1.6',
                    }}
                    onClick={() => { if (!viewOnly) { setSelectedBlockId(block.id); setActiveTab('style'); } }}
                    dangerouslySetInnerHTML={{ __html: block.content || '' }}
                  />
                );

              case 'button':
                return (
                  <div
                    key={block.id}
                    className={`text-center ${cursorClass} rounded ${outlineClass}`}
                    onClick={() => { if (!viewOnly) { setSelectedBlockId(block.id); setActiveTab('style'); } }}
                  >
                    <button
                      className="px-6 py-3 rounded-md font-semibold"
                      style={{
                        backgroundColor: block.style?.backgroundColor || '#eab308',
                        color: block.style?.textColor || '#000',
                      }}
                    >
                      {block.content}
                    </button>
                  </div>
                );

              case 'coupon':
                const selectedPromoCode = selectedPromoCodeId
                  ? promoCodes.find(pc => pc.id === selectedPromoCodeId)
                  : null;
                return (
                  <div
                    key={block.id}
                    className={`rounded-lg p-6 text-center ${cursorClass} ${outlineClass}`}
                    style={{ backgroundColor: block.style?.backgroundColor || '#10B981' }}
                    onClick={() => { if (!viewOnly) { setSelectedBlockId(block.id); setActiveTab('style'); } }}
                  >
                    {selectedPromoCode ? (
                      <>
                        <div className="text-white text-4xl font-bold mb-2">
                          {selectedPromoCode.bonus_type === 'percentage'
                            ? `${selectedPromoCode.bonus_value}%`
                            : `${selectedPromoCode.bonus_value} RCN`}
                        </div>
                        <div className="text-white font-medium">
                          Get {selectedPromoCode.bonus_type === 'percentage'
                            ? `${selectedPromoCode.bonus_value}%`
                            : `${selectedPromoCode.bonus_value} RCN`} bonus on your next visit!
                        </div>
                        <div className="text-white/70 text-sm mt-2">Use the code below when you pay</div>
                        <div className="bg-white rounded-md px-4 py-2 mt-3 text-gray-800 font-mono font-bold">
                          {selectedPromoCode.code}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-white/70 text-lg mb-2">No promo code selected</div>
                        <div className="text-white/50 text-sm">Click to select a promo code</div>
                      </>
                    )}
                  </div>
                );

              case 'service_card':
                return (
                  <div
                    key={block.id}
                    className={`rounded-xl overflow-hidden ${cursorClass} ${outlineClass}`}
                    style={{ backgroundColor: block.style?.backgroundColor || '#1a1a2e' }}
                    onClick={() => { if (!viewOnly) { setSelectedBlockId(block.id); setActiveTab('style'); } }}
                  >
                    {/* Service Image */}
                    <div className="h-32 bg-gray-800 flex items-center justify-center">
                      {block.serviceImage ? (
                        <img
                          src={block.serviceImage}
                          alt={block.serviceName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-gray-500">
                          <Image className="w-10 h-10 mb-2" />
                          <span className="text-sm">No image yet</span>
                        </div>
                      )}
                    </div>
                    {/* Service Info */}
                    <div className="p-4 bg-gray-900 border-t border-gray-700">
                      <div className="text-white font-semibold text-lg">
                        {block.serviceName || 'Service Name'}
                      </div>
                      <div className="text-emerald-400 font-medium mt-1">
                        $ {block.servicePrice ? block.servicePrice.toFixed(2) : '0.00'}
                      </div>
                    </div>
                  </div>
                );

              case 'divider':
                return (
                  <hr
                    key={block.id}
                    className={`border-gray-200 ${cursorClass} ${outlineClass}`}
                    onClick={() => { if (!viewOnly) { setSelectedBlockId(block.id); setActiveTab('style'); } }}
                  />
                );

              case 'spacer':
                return (
                  <div
                    key={block.id}
                    className={`${cursorClass} bg-gray-50 ${outlineClass}`}
                    style={{ height: block.style?.height || '20px' }}
                    onClick={() => { if (!viewOnly) { setSelectedBlockId(block.id); setActiveTab('style'); } }}
                  />
                );

              default:
                return null;
            }
          })}
        </div>

        {/* Footer */}
        {footerSocial && (
          <div className="bg-gray-100 p-4 text-center border-t">
            <div className="flex justify-center gap-4 text-gray-500 text-sm">
              <span>Website</span>
              <span>Instagram</span>
              <span>Facebook</span>
            </div>
            <p className="text-gray-400 text-xs mt-2">Unsubscribe</p>
          </div>
        )}
      </div>
    );
  };

  const selectedBlock = selectedBlockId ? blocks.find(b => b.id === selectedBlockId) : null;

  // Block editing panel
  const renderBlockEditor = () => {
    if (!selectedBlock) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm mb-4">Click on a block in the preview to edit it</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('blocks')}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blocks
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-white font-medium">
            Edit {selectedBlock.type.charAt(0).toUpperCase() + selectedBlock.type.slice(1)}
          </h4>
          <button
            onClick={() => { setSelectedBlockId(null); setActiveTab('blocks'); }}
            className="text-yellow-500 hover:text-yellow-400 text-sm font-medium"
          >
            &larr; Back
          </button>
        </div>

        {/* Rich text editor for text blocks */}
        {selectedBlock.type === 'text' && (
          <div>
            <Label className="text-gray-300 text-sm mb-2 block">Content</Label>
            <RichTextEditor
              content={selectedBlock.content || ''}
              onChange={(html) => handleUpdateBlock(selectedBlock.id, { content: html })}
              placeholder="Enter your text content..."
            />
          </div>
        )}

        {/* Simple input for headline and button */}
        {(selectedBlock.type === 'headline' || selectedBlock.type === 'button') && (
          <div>
            <Label className="text-gray-300 text-sm">Content</Label>
            <Input
              value={selectedBlock.content || ''}
              onChange={(e) => handleUpdateBlock(selectedBlock.id, { content: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
            />
          </div>
        )}

        {/* Text alignment for headline only (text blocks use TipTap alignment) */}
        {selectedBlock.type === 'headline' && (
          <div>
            <Label className="text-gray-300 text-sm">Alignment</Label>
            <div className="flex gap-2 mt-1">
              {[
                { value: 'left', icon: <AlignLeft className="w-4 h-4" /> },
                { value: 'center', icon: <AlignCenter className="w-4 h-4" /> },
                { value: 'right', icon: <AlignRight className="w-4 h-4" /> },
              ].map((align) => (
                <button
                  key={align.value}
                  onClick={() => handleUpdateBlockStyle(selectedBlock.id, { textAlign: align.value })}
                  className={`p-2 rounded ${
                    selectedBlock.style?.textAlign === align.value
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  {align.icon}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Font size for headline only (text blocks use TipTap) */}
        {selectedBlock.type === 'headline' && (
          <div>
            <Label className="text-gray-300 text-sm">Font Size</Label>
            <Select
              value={selectedBlock.style?.fontSize || (selectedBlock.type === 'headline' ? '24px' : '14px')}
              onValueChange={(value) => handleUpdateBlockStyle(selectedBlock.id, { fontSize: value })}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="12px">Small (12px)</SelectItem>
                <SelectItem value="14px">Normal (14px)</SelectItem>
                <SelectItem value="16px">Medium (16px)</SelectItem>
                <SelectItem value="18px">Large (18px)</SelectItem>
                <SelectItem value="20px">X-Large (20px)</SelectItem>
                <SelectItem value="24px">Heading (24px)</SelectItem>
                <SelectItem value="28px">Title (28px)</SelectItem>
                <SelectItem value="32px">Display (32px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Text color for headline only (text blocks use TipTap color) */}
        {selectedBlock.type === 'headline' && (
          <div>
            <Label className="text-gray-300 text-sm flex items-center gap-2">
              <Palette className="w-4 h-4" /> Text Color
            </Label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="color"
                value={selectedBlock.style?.color || '#111827'}
                onChange={(e) => handleUpdateBlockStyle(selectedBlock.id, { color: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border-0"
              />
              <Input
                value={selectedBlock.style?.color || '#111827'}
                onChange={(e) => handleUpdateBlockStyle(selectedBlock.id, { color: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white flex-1"
                placeholder="#111827"
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {colorPresets.slice(0, 10).map((color) => (
                <button
                  key={color}
                  onClick={() => handleUpdateBlockStyle(selectedBlock.id, { color })}
                  className={`w-6 h-6 rounded border-2 ${
                    selectedBlock.style?.color === color ? 'border-yellow-500' : 'border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Button styling */}
        {selectedBlock.type === 'button' && (
          <>
            <div>
              <Label className="text-gray-300 text-sm">Link URL</Label>
              <Input
                value={selectedBlock.href || ''}
                onChange={(e) => handleUpdateBlock(selectedBlock.id, { href: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="https://example.com"
              />
              <p className="text-gray-500 text-xs mt-1">Where should the button link to?</p>
            </div>
            <div>
              <Label className="text-gray-300 text-sm">Background Color</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={selectedBlock.style?.backgroundColor || '#eab308'}
                  onChange={(e) => handleUpdateBlockStyle(selectedBlock.id, { backgroundColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <Input
                  value={selectedBlock.style?.backgroundColor || '#eab308'}
                  onChange={(e) => handleUpdateBlockStyle(selectedBlock.id, { backgroundColor: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white flex-1"
                />
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {colorPresets.slice(5, 20).map((color) => (
                  <button
                    key={color}
                    onClick={() => handleUpdateBlockStyle(selectedBlock.id, { backgroundColor: color })}
                    className={`w-6 h-6 rounded border-2 ${
                      selectedBlock.style?.backgroundColor === color ? 'border-yellow-500' : 'border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-gray-300 text-sm">Text Color</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={selectedBlock.style?.textColor || '#000000'}
                  onChange={(e) => handleUpdateBlockStyle(selectedBlock.id, { textColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <Input
                  value={selectedBlock.style?.textColor || '#000000'}
                  onChange={(e) => handleUpdateBlockStyle(selectedBlock.id, { textColor: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white flex-1"
                />
              </div>
            </div>
          </>
        )}

        {/* Coupon styling */}
        {selectedBlock.type === 'coupon' && (
          <>
            {/* Promo Code Selector */}
            <div>
              <Label className="text-gray-300 text-sm">Select Promo Code</Label>
              <Select
                value={selectedPromoCodeId?.toString() || ''}
                onValueChange={(value) => handleSelectPromoCode(parseInt(value))}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue placeholder="Choose a promo code..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 max-h-60">
                  {loadingPromoCodes ? (
                    <div className="p-2 text-gray-400 text-sm">Loading promo codes...</div>
                  ) : promoCodes.length === 0 ? (
                    <div className="p-2 text-gray-400 text-sm">No active promo codes available</div>
                  ) : (
                    promoCodes.map((pc) => (
                      <SelectItem
                        key={pc.id}
                        value={pc.id.toString()}
                        className="text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono">{pc.code}</span>
                          <span className="text-emerald-400">
                            {pc.bonus_type === 'fixed' ? `${pc.bonus_value} RCN` : `${pc.bonus_value}%`}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Show selected promo code details */}
            {selectedPromoCodeId && (
              <div className="p-3 bg-gray-800 rounded-lg space-y-1">
                {(() => {
                  const selectedPC = promoCodes.find(pc => pc.id === selectedPromoCodeId);
                  if (!selectedPC) return null;
                  return (
                    <>
                      <div className="text-white font-medium">{selectedPC.name}</div>
                      <div className="text-gray-400 text-sm font-mono">{selectedPC.code}</div>
                      <div className="text-emerald-400 text-sm">
                        {selectedPC.bonus_type === 'fixed'
                          ? `${selectedPC.bonus_value} RCN bonus`
                          : `${selectedPC.bonus_value}% bonus`}
                        {selectedPC.max_bonus && ` (max ${selectedPC.max_bonus} RCN)`}
                      </div>
                      <div className="text-gray-500 text-xs">
                        Expires: {new Date(selectedPC.end_date).toLocaleDateString()}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div>
              <Label className="text-gray-300 text-sm">Background Color</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={selectedBlock.style?.backgroundColor || '#10B981'}
                  onChange={(e) => handleUpdateBlockStyle(selectedBlock.id, { backgroundColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <Input
                  value={selectedBlock.style?.backgroundColor || '#10B981'}
                  onChange={(e) => handleUpdateBlockStyle(selectedBlock.id, { backgroundColor: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white flex-1"
                />
              </div>
            </div>
          </>
        )}

        {/* Service card - service selector */}
        {selectedBlock.type === 'service_card' && (
          <>
            <div>
              <Label className="text-gray-300 text-sm">Select Service</Label>
              <Select
                value={selectedBlock.serviceId || ''}
                onValueChange={(value) => handleSelectService(selectedBlock.id, value)}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue placeholder="Choose a service..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 max-h-60">
                  {loadingServices ? (
                    <div className="p-2 text-gray-400 text-sm">Loading services...</div>
                  ) : services.length === 0 ? (
                    <div className="p-2 text-gray-400 text-sm">No services available</div>
                  ) : (
                    services.map((service) => (
                      <SelectItem
                        key={service.serviceId}
                        value={service.serviceId}
                        className="text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white">{service.serviceName}</span>
                          <span className="text-emerald-400">${service.priceUsd.toFixed(2)}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedBlock.serviceName && (
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="text-white font-medium">{selectedBlock.serviceName}</div>
                <div className="text-gray-400 text-sm">${selectedBlock.servicePrice?.toFixed(2)}</div>
              </div>
            )}
            <div>
              <Label className="text-gray-300 text-sm">Background Color</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={selectedBlock.style?.backgroundColor || '#10B981'}
                  onChange={(e) => handleUpdateBlockStyle(selectedBlock.id, { backgroundColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <Input
                  value={selectedBlock.style?.backgroundColor || '#10B981'}
                  onChange={(e) => handleUpdateBlockStyle(selectedBlock.id, { backgroundColor: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white flex-1"
                />
              </div>
            </div>
          </>
        )}

        {/* Spacer height */}
        {selectedBlock.type === 'spacer' && (
          <div>
            <Label className="text-gray-300 text-sm">Height</Label>
            <Select
              value={selectedBlock.style?.height || '20px'}
              onValueChange={(value) => handleUpdateBlockStyle(selectedBlock.id, { height: value })}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="10px">Small (10px)</SelectItem>
                <SelectItem value="20px">Medium (20px)</SelectItem>
                <SelectItem value="30px">Large (30px)</SelectItem>
                <SelectItem value="40px">X-Large (40px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Delete block button */}
        <Button
          variant="outline"
          onClick={() => handleDeleteBlock(selectedBlock.id)}
          className="w-full border-red-500/50 text-red-400 hover:bg-red-500/20 mt-4"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Block
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose(false)}>
      <DialogContent className="bg-[#1a1a1a] border-gray-800 max-w-6xl max-h-[95vh] p-0 overflow-hidden" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Campaign Builder</DialogTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onClose(false)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <h2 className="text-lg font-semibold text-white">
              {viewOnly ? 'View Campaign' : 'Design Your Campaign'}
            </h2>
            {viewOnly && existingCampaign?.status && (
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                existingCampaign.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                existingCampaign.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                existingCampaign.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {existingCampaign.status.charAt(0).toUpperCase() + existingCampaign.status.slice(1)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {viewOnly ? (
              <Button
                onClick={() => onClose(false)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  onClick={() => setStep('audience')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  Select Audience
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-8 py-3 border-b border-gray-800 bg-[#141414]">
          {['design', 'audience', 'delivery'].map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s as any)}
              className={`flex items-center gap-2 text-sm ${
                step === s ? 'text-yellow-500' : 'text-gray-500'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === s ? 'bg-yellow-500 text-black' : 'bg-gray-700'
              }`}>
                {i + 1}
              </span>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Content based on step */}
        <div className="flex-1 overflow-hidden">
          {step === 'design' && (
            <div className="flex h-[calc(95vh-140px)]">
              {/* Preview */}
              <div className="flex-1 bg-gray-800 p-6 overflow-auto">
                <div className="mb-4">
                  <Label className="text-gray-300">Campaign Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => !viewOnly && setName(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white mt-1"
                    placeholder="Enter campaign name"
                    readOnly={viewOnly}
                  />
                </div>
                <div className="mb-6">
                  <Label className="text-gray-300">Email Subject</Label>
                  <Input
                    value={subject}
                    onChange={(e) => !viewOnly && setSubject(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white mt-1"
                    placeholder="Enter email subject"
                    readOnly={viewOnly}
                  />
                </div>
                {renderPreview()}
              </div>

              {/* Editor Panel */}
              {viewOnly ? (
                <div className="w-80 bg-[#1a1a1a] border-l border-gray-800 overflow-auto p-4">
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Send className="w-8 h-8 text-green-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Campaign Sent</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      This campaign has already been sent and cannot be edited.
                    </p>
                    {existingCampaign?.sentAt && (
                      <p className="text-gray-500 text-xs">
                        Sent on {new Date(existingCampaign.sentAt).toLocaleDateString()} at {new Date(existingCampaign.sentAt).toLocaleTimeString()}
                      </p>
                    )}
                    {existingCampaign && (
                      <div className="mt-6 space-y-3 text-left">
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">Recipients</p>
                          <p className="text-white font-semibold">{existingCampaign.totalRecipients}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">In-App Sent</p>
                          <p className="text-white font-semibold">{existingCampaign.inAppSent}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">Emails Sent</p>
                          <p className="text-white font-semibold">{existingCampaign.emailsSent}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
              <div className="w-80 bg-[#1a1a1a] border-l border-gray-800 overflow-auto">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full bg-gray-800 rounded-none">
                    <TabsTrigger value="blocks" className="flex-1">Blocks</TabsTrigger>
                    <TabsTrigger value="style" className="flex-1">Edit</TabsTrigger>
                  </TabsList>

                  <TabsContent value="blocks" className="p-4 space-y-4">
                    {/* Header toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <span className="text-white text-sm">Header</span>
                      <button
                        onClick={() => setHeaderEnabled(!headerEnabled)}
                        className={`w-10 h-6 rounded-full transition-colors ${
                          headerEnabled ? 'bg-yellow-500' : 'bg-gray-600'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                          headerEnabled ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* Add Elements */}
                    <div>
                      <h4 className="text-gray-400 text-sm mb-3">Add Elements</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { type: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
                          { type: 'headline', icon: <Type className="w-5 h-5" />, label: 'Headline' },
                          { type: 'divider', icon: <Minus className="w-4 h-4" />, label: 'Divider' },
                          { type: 'spacer', icon: <Square className="w-4 h-4" />, label: 'Spacer' },
                          { type: 'button', icon: <Square className="w-4 h-4" />, label: 'Button' },
                          { type: 'image', icon: <Image className="w-4 h-4" />, label: 'Image' },
                          { type: 'coupon', icon: <Gift className="w-4 h-4" />, label: 'Coupon' },
                          { type: 'service_card', icon: <Wrench className="w-4 h-4" />, label: 'Service' },
                        ].map((item) => (
                          <button
                            key={item.type}
                            onClick={() => handleAddBlock(item.type as any)}
                            className="flex items-center gap-2 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <span className="text-gray-400">{item.icon}</span>
                            <span className="text-white text-sm">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Content Blocks with DnD */}
                    <div>
                      <h4 className="text-gray-400 text-sm mb-3">Content Blocks</h4>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={blocks.map(b => b.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {blocks.map((block) => (
                              <SortableBlockItem
                                key={block.id}
                                block={block}
                                isSelected={selectedBlockId === block.id}
                                onSelect={() => { if (!viewOnly) { setSelectedBlockId(block.id); setActiveTab('style'); } }}
                                onDelete={() => handleDeleteBlock(block.id)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>

                    {/* Footer toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <span className="text-white text-sm">Social Links</span>
                      <button
                        onClick={() => setFooterSocial(!footerSocial)}
                        className={`w-10 h-6 rounded-full transition-colors ${
                          footerSocial ? 'bg-yellow-500' : 'bg-gray-600'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                          footerSocial ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </TabsContent>

                  <TabsContent value="style" className="p-4">
                    {renderBlockEditor()}
                  </TabsContent>
                </Tabs>
              </div>
              )}
            </div>
          )}

          {step === 'audience' && (
            <div className="p-6 max-w-3xl mx-auto overflow-auto h-[calc(95vh-140px)]">
              <h3 className="text-xl font-semibold text-white mb-4">Select Your Audience</h3>
              <p className="text-gray-400 text-sm mb-6">All customers are selected by default. Uncheck customers you don&apos;t want to include.</p>

              {/* Filter and Sort Controls */}
              {!viewOnly && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search customers..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerPage(1);
                    }}
                    className="pl-10 bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                {/* Filter Dropdown */}
                <Select value={customerFilter} onValueChange={(v: any) => setCustomerFilter(v)}>
                  <SelectTrigger className="w-[170px] bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="all" className="text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white data-[state=checked]:bg-gray-700">All Customers</SelectItem>
                    <SelectItem value="most_transactions" className="text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white data-[state=checked]:bg-gray-700">Most Transactions</SelectItem>
                    <SelectItem value="active" className="text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white data-[state=checked]:bg-gray-700">Active (30 days)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort Dropdown */}
                <Select value={customerSort} onValueChange={(v: any) => setCustomerSort(v)}>
                  <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="recent" className="text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white data-[state=checked]:bg-gray-700">Most Recent</SelectItem>
                    <SelectItem value="transactions_high" className="text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white data-[state=checked]:bg-gray-700">Most Transactions</SelectItem>
                    <SelectItem value="transactions_low" className="text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white data-[state=checked]:bg-gray-700">Least Transactions</SelectItem>
                  </SelectContent>
                </Select>

                {/* Select/Deselect All */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllCustomers}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllCustomers}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              )}

              {/* Customer List */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {loadingCustomers ? (
                    <div className="text-center py-8 text-gray-400">Loading customers...</div>
                  ) : customers.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      {customerSearch ? 'No customers found matching your search' : 'No customers have visited your shop yet'}
                    </div>
                  ) : (
                    customers.map((customer) => (
                      <label
                        key={customer.walletAddress}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          viewOnly ? '' : 'cursor-pointer'
                        } ${
                          selectedCustomers.has(customer.walletAddress)
                            ? 'bg-yellow-500/20 border border-yellow-500'
                            : 'bg-gray-900 hover:bg-gray-800 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCustomers.has(customer.walletAddress)}
                          onChange={() => !viewOnly && handleToggleCustomer(customer.walletAddress)}
                          disabled={viewOnly}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-gray-900 disabled:opacity-60"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium truncate">
                              {customer.name || 'Unnamed Customer'}
                            </span>
                            {customer.tier && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase ${
                                customer.tier === 'gold' ? 'bg-yellow-500 text-black' :
                                customer.tier === 'silver' ? 'bg-gray-400 text-black' :
                                'bg-orange-500 text-white'
                              }`}>
                                {customer.tier}
                              </span>
                            )}
                          </div>
                          <div className="text-gray-500 text-sm truncate">
                            {customer.email || customer.walletAddress.slice(0, 8) + '...' + customer.walletAddress.slice(-6)}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-yellow-400 font-medium">{customer.visitCount || 0}</div>
                          <div className="text-gray-500">transactions</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {customerTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                    <div className="text-gray-400 text-sm">
                      Page {customerPage} of {customerTotalPages} ({customerTotal} total)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomerPage(p => Math.max(1, p - 1))}
                        disabled={customerPage === 1}
                        className="border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomerPage(p => Math.min(customerTotalPages, p + 1))}
                        disabled={customerPage === customerTotalPages}
                        className="border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Count */}
              <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="text-gray-400">Recipients: </span>
                    <span className="text-white font-semibold">{selectedCustomers.size} customers selected</span>
                    {customerTotal > 0 && (
                      <span className="text-gray-500 text-sm ml-2">
                        (of {customerTotal} total)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!viewOnly && (
                <div className="flex justify-between mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setStep('design')}
                    className="border-gray-600 text-gray-300"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Design
                  </Button>
                  <Button
                    onClick={() => setStep('delivery')}
                    disabled={selectedCustomers.size === 0}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black disabled:opacity-50"
                  >
                    Continue to Delivery
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 'delivery' && (
            <div className="p-6 max-w-2xl mx-auto overflow-auto h-[calc(95vh-140px)]">
              <h3 className="text-xl font-semibold text-white mb-6">Delivery Method</h3>

              <div className="space-y-3">
                {[
                  { value: 'in_app', label: 'In-App Notification', icon: <Bell className="w-5 h-5" />, desc: 'Send as an in-app notification to customers' },
                  { value: 'email', label: 'Email', icon: <Mail className="w-5 h-5" />, desc: 'Send via email (requires customer email)' },
                  { value: 'both', label: 'Both', icon: <div className="flex gap-1"><Bell className="w-5 h-5" /><Mail className="w-5 h-5" /></div>, desc: 'Send via both in-app and email' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => !viewOnly && setDeliveryMethod(option.value)}
                    disabled={viewOnly}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors ${
                      viewOnly ? 'cursor-default' : ''
                    } ${
                      deliveryMethod === option.value
                        ? 'bg-yellow-500/20 border border-yellow-500'
                        : viewOnly ? 'bg-gray-800 border border-transparent' : 'bg-gray-800 hover:bg-gray-700/50 border border-transparent'
                    }`}
                  >
                    <div className="text-gray-400">{option.icon}</div>
                    <div className="text-left flex-1">
                      <div className="text-white font-medium">{option.label}</div>
                      <div className="text-gray-400 text-sm">{option.desc}</div>
                    </div>
                    {deliveryMethod === option.value && (
                      <Check className="w-5 h-5 text-yellow-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-8 p-4 bg-gray-800 rounded-lg space-y-2">
                <h4 className="text-white font-medium mb-3">Campaign Summary</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Campaign Name:</span>
                  <span className="text-white">{name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Audience:</span>
                  <span className="text-white">{selectedCustomers.size} customers</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Delivery:</span>
                  <span className="text-white capitalize">{deliveryMethod.replace('_', ' ')}</span>
                </div>
                {campaignType === 'offer_coupon' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Coupon:</span>
                    <span className="text-white">
                      {couponType === 'percentage' ? `${couponValue}%` : `$${couponValue}`} off
                    </span>
                  </div>
                )}
              </div>

              {!viewOnly && (
                <div className="flex justify-between mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setStep('audience')}
                    className="border-gray-600 text-gray-300"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Audience
                  </Button>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleSave(false)}
                      disabled={saving}
                      className="border-gray-600 text-gray-300"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save as Draft
                    </Button>
                    <Button
                      onClick={() => handleSave(true)}
                      disabled={saving || sending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sending ? 'Sending...' : 'Send Now'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
