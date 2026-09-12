"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AGENT_TERMS_VERSION } from "@/lib/location-options";

interface AgentRegistrationTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentRegistrationTermsDialog({ open, onOpenChange }: AgentRegistrationTermsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Terms & Conditions</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground/80">Version {AGENT_TERMS_VERSION}</p>
          <p>
            By registering as an agent with Trevio Global, you confirm that the business and contact
            information you provide is accurate and that you are authorized to register on behalf of
            the company named in this form.
          </p>
          <p>
            You agree to use the Trevio Global platform in accordance with applicable laws, to keep
            your login credentials confidential, and not to misuse inventory, pricing, or customer data.
          </p>
          <p>
            Trevio Global may review registrations, suspend accounts that violate these terms, and
            update these terms from time to time. Continued use of the agent portal after updates
            constitutes acceptance of the revised terms.
          </p>
          <p>
            Payment, commission, and commercial terms for bookings are governed by your agency
            agreement and the policies shown at the time of quotation or booking.
          </p>
          <p>
            For questions about these terms, contact support through the Trevio Global support
            channels after login, or your Trevio account manager.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
