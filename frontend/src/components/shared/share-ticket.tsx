"use client";

import { MessageCircle, Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function ShareTicket({ subject, text }: { subject: string; text: string }) {
  const { toast } = useToast();

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Ticket details copied to clipboard." });
    } catch {
      toast({ title: "Couldn't copy", description: "Your browser blocked clipboard access.", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
        </a>
      </Button>
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <a href={mailUrl}>
          <Mail className="w-3.5 h-3.5 text-sky-600" /> Email
        </a>
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={copyToClipboard}>
        <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Copy
      </Button>
    </div>
  );
}
