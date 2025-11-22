import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Check, X, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";

const messageSchema = z.object({
  content: z.string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message must be less than 2000 characters")
    .trim()
});

const Matches = () => {
  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchMatches(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!selectedMatch) return;

    fetchMessages(selectedMatch.id);

    const channel = supabase
      .channel(`messages-${selectedMatch.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${selectedMatch.id}`,
        },
        (payload) => {
          setMessages((current) => [...current, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMatch]);

  const fetchMatches = async (userId: string) => {
    setLoading(true);
    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select(`
          *,
          parts(part_name, price),
          part_requests(part_name, max_price)
        `)
        .or(`supplier_id.eq.${userId},requester_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (matchesError) {
        console.error("Error fetching matches:", matchesError);
        setLoading(false);
        return;
      }

      const matches = matchesData ?? [];
      const supplierIds = matches.map((m: any) => m.supplier_id).filter(Boolean);
      const requesterIds = matches.map((m: any) => m.requester_id).filter(Boolean);
      const uniqueIds = Array.from(new Set([...supplierIds, ...requesterIds]));

      let profilesById: Record<string, any> = {};
      if (uniqueIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("public_profiles")
          .select("id, full_name, trade_type")
          .in("id", uniqueIds);

        if (profilesError) {
          console.error("Error loading profiles:", profilesError);
        } else if (profilesData) {
          profilesById = Object.fromEntries(profilesData.map((p: any) => [p.id, p]));
        }
      }

      const matchesWithProfiles = matches.map((m: any) => ({
        ...m,
        supplier: profilesById[m.supplier_id] ?? null,
        requester: profilesById[m.requester_id] ?? null,
      }));

      setMatches(matchesWithProfiles);
    } catch (e) {
      console.error("Error in fetchMatches:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (matchId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (data) setMessages(data);
  };

  const handleAgree = async (matchId: string, isSupplier: boolean) => {
    try {
      const updateField = isSupplier ? "supplier_agreed" : "requester_agreed";
      const { data: matchData } = await supabase
        .from("matches")
        .select("supplier_agreed, requester_agreed")
        .eq("id", matchId)
        .single();

      const otherAgreed = isSupplier ? matchData?.requester_agreed : matchData?.supplier_agreed;
      const newStatus = otherAgreed ? "both_agreed" : "pending";

      const { error } = await supabase
        .from("matches")
        .update({ [updateField]: true, status: newStatus })
        .eq("id", matchId);

      if (error) throw error;

      toast({
        title: "Success",
        description: newStatus === "both_agreed" 
          ? "Both parties agreed! You can now exchange contact details." 
          : "You've agreed to connect. Waiting for the other party.",
      });
      
      fetchMatches(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const sendMessage = async () => {
    if (!selectedMatch) return;

    // Validate message content
    const validation = messageSchema.safeParse({ content: newMessage });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Invalid Message",
        description: validation.error.errors[0].message,
      });
      return;
    }

    try {
      const otherUserId = selectedMatch.supplier_id === user.id 
        ? selectedMatch.requester_id 
        : selectedMatch.supplier_id;

      const { error } = await supabase.from("messages").insert({
        match_id: selectedMatch.id,
        sender_id: user.id,
        receiver_id: otherUserId,
        content: validation.data.content,
      });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout user={user}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Matches & Messages</h1>
          <p className="text-muted-foreground mb-6">Connect with other technicians</p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <h2 className="text-xl font-semibold">Your Matches ({matches.length})</h2>
              {matches.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No matches yet</p>
                  </CardContent>
                </Card>
              ) : (
                matches.map((match) => {
                  const isSupplier = match.supplier_id === user.id;
                  const otherUser = isSupplier ? match.requester : match.supplier;
                  const itemName = match.parts?.[0]?.part_name || match.part_requests?.[0]?.part_name || "Unknown";
                  
                  return (
                    <Card
                      key={match.id}
                      className={`cursor-pointer transition-all ${
                        selectedMatch?.id === match.id ? "ring-2 ring-primary" : "hover:shadow-medium"
                      }`}
                      onClick={() => setSelectedMatch(match)}
                    >
                      <CardHeader>
                        <CardTitle className="text-sm">{itemName}</CardTitle>
                        <CardDescription className="text-xs">
                          {otherUser?.full_name} ({otherUser?.trade_type})
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-xs">
                          {match.status === "both_agreed" ? (
                            <span className="text-green-600 flex items-center">
                              <Check className="h-3 w-3 mr-1" />
                              Connected
                            </span>
                          ) : (
                            <span className="text-yellow-600">Pending</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="md:col-span-2">
              {selectedMatch ? (
                <Card className="h-[600px] flex flex-col">
                  <CardHeader>
                    <CardTitle>
                      {selectedMatch.parts?.[0]?.part_name || selectedMatch.part_requests?.[0]?.part_name}
                    </CardTitle>
                    <CardDescription>
                      Chat with {selectedMatch.supplier_id === user.id 
                        ? selectedMatch.requester?.full_name 
                        : selectedMatch.supplier?.full_name}
                    </CardDescription>
                  </CardHeader>

                  {selectedMatch.status !== "both_agreed" && (
                    <div className="px-6 pb-4">
                      <Alert>
                        <AlertDescription>
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Privacy Protection</p>
                            <p className="text-sm">
                              Contact information will be shared only when both parties agree to connect.
                            </p>
                            {selectedMatch.supplier_id === user.id ? (
                              !selectedMatch.supplier_agreed && (
                                <Button size="sm" onClick={() => handleAgree(selectedMatch.id, true)}>
                                  <Check className="mr-2 h-4 w-4" />
                                  I Agree to Connect
                                </Button>
                              )
                            ) : (
                              !selectedMatch.requester_agreed && (
                                <Button size="sm" onClick={() => handleAgree(selectedMatch.id, false)}>
                                  <Check className="mr-2 h-4 w-4" />
                                  I Agree to Connect
                                </Button>
                              )
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <CardContent className="flex-1 overflow-y-auto space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender_id === user.id ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            message.sender_id === user.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(message.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>

                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                      />
                      <Button onClick={sendMessage}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="h-[600px] flex items-center justify-center">
                  <CardContent className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Select a match to start chatting</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Matches;