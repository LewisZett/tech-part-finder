import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { AiMatchSuggestions } from "@/components/AiMatchSuggestions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Package, ShoppingCart, MapPin } from "lucide-react";

const Browse = () => {
  const [user, setUser] = useState<any>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchData();
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [partsRes, requestsRes] = await Promise.all([
        supabase.from("parts").select("*").eq("status", "available"),
        supabase.from("part_requests").select("*").eq("status", "active"),
      ]);

      const partsData = partsRes.data ?? [];
      const requestsData = requestsRes.data ?? [];

      const supplierIds = partsData.map((p: any) => p.supplier_id);
      const requesterIds = requestsData.map((r: any) => r.requester_id);
      const uniqueIds = Array.from(new Set([...supplierIds, ...requesterIds].filter(Boolean)));

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

      const partsWithProfiles = partsData.map((p: any) => ({
        ...p,
        public_profiles: profilesById[p.supplier_id] ?? null,
      }));

      const requestsWithProfiles = requestsData.map((r: any) => ({
        ...r,
        public_profiles: profilesById[r.requester_id] ?? null,
      }));

      setParts(partsWithProfiles);
      setRequests(requestsWithProfiles);
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = async (type: "part" | "request", itemId: string, ownerId: string) => {
    if (!user) return;

    try {
      const matchData = type === "part"
        ? { part_id: itemId, supplier_id: ownerId, requester_id: user.id }
        : { request_id: itemId, requester_id: ownerId, supplier_id: user.id };

      const { data: matchResult, error } = await supabase.from("matches").insert(matchData).select().single();

      if (error) throw error;

      // Get the item name for notifications
      let itemName = "Unknown Item";
      if (type === "part") {
        const part = parts.find(p => p.id === itemId);
        itemName = part?.part_name || "Unknown Part";
      } else {
        const request = requests.find(r => r.id === itemId);
        itemName = request?.part_name || "Unknown Request";
      }

      // Send notifications in background (don't await)
      supabase.functions.invoke("send-match-notification", {
        body: {
          matchId: matchResult.id,
          supplierId: matchData.supplier_id,
          requesterId: matchData.requester_id,
          itemName,
          itemType: type,
        },
      }).then(({ error: notifError }) => {
        if (notifError) {
          console.error("Error sending notifications:", notifError);
        } else {
          console.log("Notifications sent successfully");
        }
      });

      toast({
        title: "Match Created!",
        description: "Notifications sent. You can now start chatting with this user.",
      });
      navigate("/matches");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const filteredParts = parts.filter(
    (part) =>
      part.part_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRequests = requests.filter(
    (request) =>
      request.part_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4 glow-cyan"></div>
          <p className="text-primary font-orbitron text-xl">LOADING...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout user={user}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent text-center">BROWSE MARKET</h1>
          <p className="text-foreground/80 mb-6 text-center font-rajdhani text-lg">
            DISCOVER • CONNECT • TRADE
          </p>

          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary" />
            <Input
              placeholder="SEARCH BY PART OR CATEGORY..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-primary/30 focus:border-primary bg-card/50 font-rajdhani"
            />
          </div>

          <Tabs defaultValue="parts" className="space-y-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-card/50 border border-primary/30">
              <TabsTrigger value="parts" className="font-orbitron data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                PARTS ({filteredParts.length})
              </TabsTrigger>
              <TabsTrigger value="requests" className="font-orbitron data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                REQUESTS ({filteredRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="parts" className="space-y-4">
              {filteredParts.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Package className="h-16 w-16 text-primary mb-4 glow-cyan" />
                    <p className="text-foreground/70 font-rajdhani text-lg">NO PARTS FOUND</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredParts.map((part) => (
                    <Card key={part.id} className="hover:scale-[1.02] transition-transform glass-card glow-cyan">
                      {part.image_url && (
                        <div className="w-full h-48 overflow-hidden rounded-t-lg relative">
                          <img 
                            src={part.image_url} 
                            alt={part.part_name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent"></div>
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <CardTitle className="text-lg text-primary font-orbitron">{part.part_name}</CardTitle>
                          <Badge variant="secondary" className="bg-secondary/20 text-secondary border border-secondary/40">{part.condition}</Badge>
                        </div>
                        <CardDescription className="space-y-1">
                          <div className="flex items-center text-sm text-foreground/70">
                            <Package className="h-4 w-4 mr-1 text-primary" />
                            {part.category}
                          </div>
                          {part.location && (
                            <div className="flex items-center text-sm text-foreground/70">
                              <MapPin className="h-4 w-4 mr-1 text-accent" />
                              {part.location}
                            </div>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {part.description && (
                          <p className="text-sm text-foreground/70 mb-3 font-rajdhani">{part.description}</p>
                        )}
                        {part.price && (
                          <p className="text-2xl font-bold text-primary mb-3 glow-cyan">${part.price}</p>
                        )}
                        <div className="text-sm text-foreground/60 mb-3 font-rajdhani">
                          LISTED BY: {part.public_profiles?.full_name || "ANONYMOUS"} ({part.public_profiles?.trade_type})
                        </div>
                        {part.supplier_id !== user?.id && (
                          <>
                            <Button
                              className="w-full mb-2"
                              onClick={() => handleCreateMatch("part", part.id, part.supplier_id)}
                            >
                              CONTACT SUPPLIER
                            </Button>
                            <AiMatchSuggestions 
                              itemId={part.id} 
                              itemType="part" 
                              itemData={part}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="requests" className="space-y-4">
              {filteredRequests.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingCart className="h-16 w-16 text-secondary mb-4 glow-purple" />
                    <p className="text-foreground/70 font-rajdhani text-lg">NO REQUESTS FOUND</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRequests.map((request) => (
                    <Card key={request.id} className="hover:scale-[1.02] transition-transform glass-card glow-purple">
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <CardTitle className="text-lg text-secondary font-orbitron">{request.part_name}</CardTitle>
                          {request.condition_preference && (
                            <Badge variant="secondary" className="bg-secondary/20 text-secondary border border-secondary/40">{request.condition_preference}</Badge>
                          )}
                        </div>
                        <CardDescription className="space-y-1">
                          <div className="flex items-center text-sm text-foreground/70">
                            <Package className="h-4 w-4 mr-1 text-secondary" />
                            {request.category}
                          </div>
                          {request.location && (
                            <div className="flex items-center text-sm text-foreground/70">
                              <MapPin className="h-4 w-4 mr-1 text-accent" />
                              {request.location}
                            </div>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {request.description && (
                          <p className="text-sm text-foreground/70 mb-3 font-rajdhani">{request.description}</p>
                        )}
                        {request.max_price && (
                          <p className="text-lg font-semibold text-accent mb-3 glow-magenta">
                            BUDGET: UP TO ${request.max_price}
                          </p>
                        )}
                        <div className="text-sm text-foreground/60 mb-3 font-rajdhani">
                          REQUESTED BY: {request.public_profiles?.full_name || "ANONYMOUS"} ({request.public_profiles?.trade_type})
                        </div>
                        {request.requester_id !== user?.id && (
                          <>
                            <Button
                              className="w-full mb-2"
                              variant="secondary"
                              onClick={() => handleCreateMatch("request", request.id, request.requester_id)}
                            >
                              I HAVE THIS PART
                            </Button>
                            <AiMatchSuggestions 
                              itemId={request.id} 
                              itemType="request" 
                              itemData={request}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default Browse;