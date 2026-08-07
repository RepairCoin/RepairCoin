import { useState } from "react";
import { useAppToast } from "@/shared/hooks";
import { Contact, ContactStatus, CreateContactData, UpdateContactData } from "../services/marketing.interface";

export interface ContactFormData {
  fullName: string;
  email: string;
  phone: string;
  tags: string[];
  notes: string;
  status: ContactStatus;
}

const EMPTY_FORM: ContactFormData = {
  fullName: "",
  email: "",
  phone: "",
  tags: [],
  notes: "",
  status: "active",
};

/** Add/edit contact form state + validation. Mirrors the DB CHECK on `contact_imports`: at least
 *  one of email/phone is required (see backend/src/repositories/ContactRepository.ts). */
export function useContactForm(existingContact?: Contact | null) {
  const { showError } = useAppToast();

  const [formData, setFormData] = useState<ContactFormData>(
    existingContact
      ? {
          fullName: existingContact.fullName,
          email: existingContact.email ?? "",
          phone: existingContact.phone ?? "",
          tags: existingContact.tags,
          notes: existingContact.notes ?? "",
          status: existingContact.status,
        }
      : EMPTY_FORM
  );

  function updateField<K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    if (!formData.fullName.trim()) {
      showError("Name is required");
      return false;
    }
    if (!formData.email.trim() && !formData.phone.trim()) {
      showError("Enter an email or phone number");
      return false;
    }
    return true;
  }

  function toCreateData(): CreateContactData {
    return {
      fullName: formData.fullName.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      tags: formData.tags,
      notes: formData.notes.trim() || null,
    };
  }

  function toUpdateData(): UpdateContactData {
    return {
      fullName: formData.fullName.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      status: formData.status,
      tags: formData.tags,
      notes: formData.notes.trim() || null,
    };
  }

  function reset() {
    setFormData(EMPTY_FORM);
  }

  return {
    formData,
    updateField,
    validate,
    toCreateData,
    toUpdateData,
    reset,
  };
}
