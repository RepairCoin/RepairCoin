'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles = {
  default: {
    icon: <AlertCircle className="w-6 h-6 text-blue-500" />,
    confirmButton: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  danger: {
    icon: <XCircle className="w-6 h-6 text-red-500" />,
    confirmButton: "bg-red-600 hover:bg-red-700 text-white",
  },
  warning: {
    icon: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
    confirmButton: "bg-yellow-600 hover:bg-yellow-700 text-white",
  },
  success: {
    icon: <CheckCircle className="w-6 h-6 text-green-500" />,
    confirmButton: "bg-green-600 hover:bg-green-700 text-white",
  },
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'default',
  isLoading = false,
  icon,
}) => {
  const styles = variantStyles[variant];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="flex flex-row items-start gap-3">
          <div className="mt-1">
            {icon || styles.icon}
          </div>
          <div className="flex-1">
            <DialogTitle className="text-lg font-semibold">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-gray-600">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="sm:mr-2"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={styles.confirmButton}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </div>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Preset modals for common actions
export const SuspendCustomerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  customerName?: string;
  customerAddress: string;
  isLoading?: boolean;
}> = ({ isOpen, onClose, onConfirm, customerName, customerAddress, isLoading }) => {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Suspend Customer"
      description={`Are you sure you want to suspend ${customerName || 'this customer'} (${customerAddress})? They will not be able to earn or redeem tokens until unsuspended.`}
      confirmText="Suspend Customer"
      cancelText="Cancel"
      variant="danger"
      isLoading={isLoading}
    />
  );
};

export const UnsuspendCustomerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  customerName?: string;
  customerAddress: string;
  isLoading?: boolean;
}> = ({ isOpen, onClose, onConfirm, customerName, customerAddress, isLoading }) => {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Unsuspend Customer"
      description={`Are you sure you want to unsuspend ${customerName || 'this customer'} (${customerAddress})? They will be able to earn and redeem tokens again.`}
      confirmText="Unsuspend Customer"
      cancelText="Cancel"
      variant="success"
      isLoading={isLoading}
    />
  );
};

export const SuspendShopModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  shopName: string;
  shopId: string;
  isLoading?: boolean;
}> = ({ isOpen, onClose, onConfirm, shopName, shopId, isLoading }) => {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Suspend Shop"
      description={`Are you sure you want to suspend ${shopName} (${shopId})? They will not be able to issue or redeem tokens until unsuspended.`}
      confirmText="Suspend Shop"
      cancelText="Cancel"
      variant="danger"
      isLoading={isLoading}
    />
  );
};

export const UnsuspendShopModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  shopName: string;
  shopId: string;
  isLoading?: boolean;
}> = ({ isOpen, onClose, onConfirm, shopName, shopId, isLoading }) => {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Unsuspend Shop"
      description={`Are you sure you want to unsuspend ${shopName} (${shopId})? They will be able to issue and redeem tokens again.`}
      confirmText="Unsuspend Shop"
      cancelText="Cancel"
      variant="success"
      isLoading={isLoading}
    />
  );
};

export const ApproveShopModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  shopName: string;
  shopId: string;
  isLoading?: boolean;
}> = ({ isOpen, onClose, onConfirm, shopName, shopId, isLoading }) => {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Approve Shop Application"
      description={`Are you sure you want to approve ${shopName} (${shopId})? They will be able to start issuing tokens to customers.`}
      confirmText="Approve Shop"
      cancelText="Cancel"
      variant="success"
      isLoading={isLoading}
    />
  );
};