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
import { Search, MapPin } from "lucide-react";
import { useCategory, categoryConfigs } from "@/contexts/CategoryContext";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonCardGrid } from "@/components/ui/skeleton-card";
import { PartImagePlaceholder } from "@/components/PartImagePlaceholder";

const Browse = () => {
  const [user, setUser] = useState<any>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedCategory, config } = useCategory();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedCategory]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const categoryMap: Record<string, string> = {
        phone: "Phone Spare Parts",
        tv: "TV Spare Parts",
        computer: "Computer Spare Parts",
        car: "Car Spare Parts",
      };
      const dbCategory = categoryMap[selectedCategory];

      const [partsRes, requestsRes] = await Promise.all([
        supabase.from("parts").select("*").eq("status", "available").eq("category", dbCategory),
        supabase.from("part_requests").select("*").eq("status", "active").eq("category", dbCategory),
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
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to contact sellers or post requests.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      const matchData = type === "part"
        ? { part_id: itemId, supplier_id: ownerId, requester_id: user.id }
        : { request_id: itemId, requester_id: ownerId, supplier_id: user.id };

      const { data: matchResult, error } = await supabase.from("matches").insert(matchData).select().single();

      if (error) throw error;

      let itemName = "Unknown Item";
      if (type === "part") {
        const part = parts.find(p => p.id === itemId);
        itemName = part?.part_name || "Unknown Part";
      } else {
        const request = requests.find(r => r.id === itemId);
        itemName = request?.part_name || "Unknown Request";
      }

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
        }
      });

      toast({
        title: "Match Created!",
        description: "You can now start chatting with this user.",
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
      part.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (part.vehicle_make && part.vehicle_make.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (part.vehicle_model && part.vehicle_model.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredRequests = requests.filter(
    (request) =>
      request.part_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryIcon = (category: string) => {
    if (category.toLowerCase().includes("phone")) return "📱";
    if (category.toLowerCase().includes("tv")) return "📺";
    if (category.toLowerCase().includes("computer")) return "🖥️";
    if (category.toLowerCase().includes("car")) return "🚗";
    return "📦";
  };

  return (
    <AppLayout user={user}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-foreground text-center font-orbitron">
            {config.label}
          </h1>
          <p className="text-muted-foreground mb-6 text-center text-lg">
            Zimbabwe's Spare Parts Marketplace
          </p>

          <div className="mb-6 relative max-w-xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder={config.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 border-border focus:border-primary bg-card/50"
            />
          </div>

          {loading ? (
            <SkeletonCardGrid count={6} />
          ) : (
            <Tabs defaultValue="parts" className="space-y-6">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-card border border-border">
                <TabsTrigger value="parts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Spare Parts ({filteredParts.length})
                </TabsTrigger>
                <TabsTrigger value="requests" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                  Requests ({filteredRequests.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="parts" className="space-y-4">
                {filteredParts.length === 0 ? (
                  <EmptyState
                    type={searchQuery ? "search" : "parts"}
                    onAction={() => searchQuery ? setSearchQuery("") : navigate("/my-listings")}
                  />
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredParts.map((part) => (
                      <Card key={part.id} className="hover:shadow-lg transition-shadow overflow-hidden relative">
                        <div className="absolute top-3 right-3 z-10">
                          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                            {getCategoryIcon(part.category)} {part.category.split(" ")[0]}
                          </Badge>
                        </div>
                        {part.image_url ? (
                          <div className="w-full h-48 overflow-hidden relative">
                            <img 
                              src={part.image_url} 
                              alt={part.part_name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent"></div>
                          </div>
                        ) : (
                          <PartImagePlaceholder category={part.category} />
                        )}
                        <CardHeader>
                          <div className="flex items-start justify-between mb-2">
                            <CardTitle className="text-lg text-foreground">{part.part_name}</CardTitle>
                            <Badge variant="outline">{part.condition}</Badge>
                          </div>
                          <CardDescription className="space-y-1">
                            {part.category === "Car Spare Parts" && part.vehicle_make && (
                              <div className="text-sm font-medium text-primary/80 mb-1">
                                🚗 {part.vehicle_make}
                                {part.vehicle_model && ` ${part.vehicle_model}`}
                                {part.vehicle_year_from && (
                                  <span className="text-muted-foreground">
                                    {" "}({part.vehicle_year_from}{part.vehicle_year_to && part.vehicle_year_to !== part.vehicle_year_from ? `-${part.vehicle_year_to}` : ""})
                                  </span>
                                )}
                              </div>
                            )}
                            {part.location && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4 mr-1 text-teal" />
                                {part.location}
                              </div>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {part.description && (
                            <p className="text-sm text-muted-foreground mb-3">{part.description}</p>
                          )}
                          {part.price && (
                            <p className="text-2xl font-bold text-primary mb-3">${part.price}</p>
                          )}
                          <div className="text-sm text-muted-foreground mb-3">
                            Listed by: {part.public_profiles?.full_name || "Anonymous"} ({part.public_profiles?.trade_type})
                          </div>
                          {part.supplier_id !== user?.id && (
                            <>
                              <Button
                                className="w-full mb-2 bg-teal hover:bg-teal/90 text-teal-foreground"
                                onClick={() => handleCreateMatch("part", part.id, part.supplier_id)}
                              >
                                Contact Supplier
                              </Button>
                              {user && (
                                <AiMatchSuggestions 
                                  itemId={part.id} 
                                  itemType="part" 
                                  itemData={part}
                                />
                              )}
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
                  <EmptyState
                    type={searchQuery ? "search" : "requests"}
                    onAction={() => searchQuery ? setSearchQuery("") : navigate("/my-listings?action=create-request")}
                  />
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRequests.map((request) => (
                      <Card key={request.id} className="hover:shadow-lg transition-shadow overflow-hidden relative">
                        <div className="absolute top-3 right-3 z-10">
                          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                            {getCategoryIcon(request.category)} {request.category.split(" ")[0]}
                          </Badge>
                        </div>
                        <CardHeader className="pt-12">
                          <div className="flex items-start justify-between mb-2">
                            <CardTitle className="text-lg text-secondary">{request.part_name}</CardTitle>
                            {request.condition_preference && (
                              <Badge variant="outline">{request.condition_preference}</Badge>
                            )}
                          </div>
                          <CardDescription className="space-y-1">
                            {request.location && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4 mr-1 text-teal" />
                                {request.location}
                              </div>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {request.description && (
                            <p className="text-sm text-muted-foreground mb-3">{request.description}</p>
                          )}
                          {request.max_price && (
                            <p className="text-lg font-semibold text-accent mb-3">
                              Budget: Up to ${request.max_price}
                            </p>
                          )}
                          <div className="text-sm text-muted-foreground mb-3">
                            Requested by: {request.public_profiles?.full_name || "Anonymous"} ({request.public_profiles?.trade_type})
                          </div>
                          {request.requester_id !== user?.id && (
                            <>
                              <Button
                                className="w-full mb-2"
                                variant="secondary"
                                onClick={() => handleCreateMatch("request", request.id, request.requester_id)}
                              >
                                I Have This Part
                              </Button>
                              {user && (
                                <AiMatchSuggestions 
                                  itemId={request.id} 
                                  itemType="request" 
                                  itemData={request}
                                />
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Browse;
