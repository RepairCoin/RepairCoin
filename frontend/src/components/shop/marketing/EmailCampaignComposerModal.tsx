"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import {
  X,
  Send,
  Mail,
  TestTube,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/services/api/client";

interface EmailCampaignComposerModalProps {
  open: boolean;
  onClose: () => void;
  shopId: string;
  selectedContactIds?: string[];
  totalContacts: number;
}

interface SendResult {
  totalRecipients: number;
  sent: number;
  failed: number;
}

export function EmailCampaignComposerModal({
  open,
  onClose,
  shopId,
  selectedContactIds,
  totalContacts,
}: EmailCampaignComposerModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const recipientCount = selectedContactIds?.length || totalContacts;

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error("Please enter a test email address");
      return;
    }

    if (!subject || !message) {
      toast.error("Please enter subject and message first");
      return;
    }

    try {
      setSendingTest(true);

      await apiClient.post(`/marketing/shops/${shopId}/contacts/test-email`, {
        subject,
        htmlContent: convertToHtml(message),
        testEmail,
      });

      toast.success(`Test email sent to ${testEmail}`);
    } catch (error: unknown) {
      console.error("Test email error:", error);
      if (error && typeof error === "object" && "message" in error) {
        toast.error((error as { message: string }).message);
      } else {
        toast.error("Failed to send test email");
      }
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!subject || !message) {
      toast.error("Please enter subject and message");
      return;
    }

    if (!confirm(`Send email to ${recipientCount} contacts? This action cannot be undone.`)) {
      return;
    }

    try {
      setSending(true);

      const payload: {
        subject: string;
        htmlContent: string;
        contactIds?: string[];
      } = {
        subject,
        htmlContent: convertToHtml(message),
      };

      // Only include contactIds if specific contacts are selected
      if (selectedContactIds && selectedContactIds.length > 0) {
        payload.contactIds = selectedContactIds;
      }

      const data = await apiClient.post<{ data: SendResult }>(
        `/marketing/shops/${shopId}/contacts/send-email`,
        payload
      );

      setResult(data.data);

      toast.success(`Campaign sent! ${data.data.sent} emails delivered successfully`);
    } catch (error: unknown) {
      console.error("Send campaign error:", error);
      if (error && typeof error === "object" && "message" in error) {
        toast.error((error as { message: string }).message);
      } else {
        toast.error("Failed to send email campaign");
      }
    } finally {
      setSending(false);
    }
  };

  // Returns a body fragment only; the backend wraps it in the branded template.
  const convertToHtml = (text: string): string => {
    return text
      .split("\n")
      .map((line) =>
        line.trim()
          ? `<p style="margin: 0 0 10px 0; color: #555; font-size: 16px; line-height: 1.6;">${line}</p>`
          : "<br>"
      )
      .join("");
  };

  const handleClose = () => {
    if (!sending) {
      setSubject("");
      setMessage("");
      setTestEmail("");
      setResult(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1a1a] border-gray-800 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Email Campaign
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6">
            {/* Recipient Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-white font-medium">
                    {selectedContactIds?.length
                      ? `Sending to ${recipientCount} selected contacts`
                      : `Sending to all ${recipientCount} active contacts`}
                  </p>
                  <p className="text-sm text-gray-400">
                    Only contacts with valid email addresses will receive this campaign
                  </p>
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-white">
                Subject Line *
              </Label>
              <Input
                id="subject"
                placeholder="e.g., Special Offer - 20% Off All Services"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
                disabled={sending || sendingTest}
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message" className="text-white">
                Message *
              </Label>
              <Textarea
                id="message"
                placeholder="Write your email message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={12}
                className="bg-gray-800 border-gray-700 text-white resize-none"
                disabled={sending || sendingTest}
              />
              <p className="text-xs text-gray-400">
                Your message will be formatted as HTML. Line breaks will be preserved.
              </p>
            </div>

            {/* Test Email Section */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TestTube className="w-5 h-5 text-yellow-400" />
                <p className="text-white font-medium">Send Test Email</p>
              </div>
              <p className="text-sm text-gray-400">
                Preview your email before sending to all contacts
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="your-email@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white flex-1"
                  disabled={sending || sendingTest}
                />
                <Button
                  onClick={handleTestEmail}
                  disabled={!subject || !message || !testEmail || sending || sendingTest}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black"
                >
                  {sendingTest ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <p className="font-medium text-white mb-1">Important Notes:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>All emails will include an unsubscribe link (required by law)</li>
                    <li>This action cannot be undone</li>
                    <li>Large campaigns may take several minutes to complete</li>
                    <li>Make sure your SendGrid API key is configured</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Success Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
                <Mail className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-400">{result.totalRecipients}</p>
                <p className="text-sm text-gray-400">Total Recipients</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-400">{result.sent}</p>
                <p className="text-sm text-gray-400">Sent Successfully</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                <p className="text-sm text-gray-400">Failed</p>
              </div>
            </div>

            {/* Success Message */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium mb-1">Campaign Sent Successfully!</p>
                  <p className="text-sm text-gray-300">
                    Your email campaign has been delivered to {result.sent} contacts.
                    {result.failed > 0 &&
                      ` ${result.failed} email(s) failed to send - these may be invalid addresses.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Campaign Details */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
              <p className="text-white font-medium">Campaign Details:</p>
              <div className="space-y-1 text-sm">
                <p className="text-gray-400">
                  <span className="text-white">Subject:</span> {subject}
                </p>
                <p className="text-gray-400">
                  <span className="text-white">Success Rate:</span>{" "}
                  {((result.sent / result.totalRecipients) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={sending || sendingTest}
                className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendCampaign}
                disabled={!subject || !message || sending || sendingTest}
                className="bg-yellow-500 hover:bg-yellow-400 text-black"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending to {recipientCount} contacts...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Campaign
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleClose}
              className="bg-yellow-500 hover:bg-yellow-400 text-black"
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
