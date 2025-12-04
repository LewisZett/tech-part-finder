import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DollarSign, Send } from "lucide-react";
import type { Quote } from "@/types/database";

const quoteSchema = z.object({
  proposed_price: z.number().min(0.01, "Price must be greater than 0"),
  message: z.string().max(500, "Message must be less than 500 characters").optional(),
});

interface QuoteDialogProps {
  matchId: string;
  currentUserId: string;
  otherUserId: string;
  existingQuotes: Quote[];
  onQuoteSent: () => void;
}

export function QuoteDialog({
  matchId,
  currentUserId,
  otherUserId,
  existingQuotes,
  onQuoteSent,
}: QuoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const latestQuote = existingQuotes
    .filter((q) => q.status === "pending")
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

  const handleSubmit = async () => {
    const validation = quoteSchema.safeParse({
      proposed_price: parseFloat(price),
      message: message || undefined,
    });

    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Invalid Quote",
        description: validation.error.errors[0].message,
      });
      return;
    }

    setLoading(true);
    try {
      // If countering, update the old quote status
      if (latestQuote && latestQuote.receiver_id === currentUserId) {
        await supabase
          .from("quotes")
          .update({ status: "countered" })
          .eq("id", latestQuote.id);
      }

      const { error } = await supabase.from("quotes").insert({
        match_id: matchId,
        sender_id: currentUserId,
        receiver_id: otherUserId,
        proposed_price: validation.data.proposed_price,
        message: validation.data.message || null,
      });

      if (error) throw error;

      toast({
        title: "Quote Sent",
        description: "Your price proposal has been sent.",
      });

      setOpen(false);
      setPrice("");
      setMessage("");
      onQuoteSent();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send quote",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (quoteId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ status: "accepted" })
        .eq("id", quoteId);

      if (error) throw error;

      toast({
        title: "Quote Accepted",
        description: "You've accepted the price. Proceed to create an order.",
      });
      onQuoteSent();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to accept quote",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (quoteId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ status: "rejected" })
        .eq("id", quoteId);

      if (error) throw error;

      toast({
        title: "Quote Rejected",
        description: "You've rejected the price proposal.",
      });
      onQuoteSent();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject quote",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {latestQuote && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {latestQuote.sender_id === currentUserId ? "Your offer" : "Their offer"}
              </p>
              <p className="text-lg font-bold text-primary">
                ${latestQuote.proposed_price.toFixed(2)}
              </p>
              {latestQuote.message && (
                <p className="text-sm text-muted-foreground mt-1">{latestQuote.message}</p>
              )}
            </div>
            {latestQuote.receiver_id === currentUserId && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(latestQuote.id)}
                  disabled={loading}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(latestQuote.id)}
                  disabled={loading}
                >
                  Accept
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <DollarSign className="h-4 w-4 mr-2" />
            {latestQuote ? "Counter Offer" : "Send Quote"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {latestQuote ? "Make a Counter Offer" : "Send Price Quote"}
            </DialogTitle>
            <DialogDescription>
              Propose a price for this transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="price">Proposed Price ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a note about your offer..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
              />
            </div>
            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              {loading ? "Sending..." : "Send Quote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
