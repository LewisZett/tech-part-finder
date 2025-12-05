import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ShoppingCart,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  MapPin,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Order, PublicProfile } from "@/types/database";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-500/10 text-yellow-600", icon: <Clock className="h-4 w-4" /> },
  confirmed: { label: "Confirmed", color: "bg-blue-500/10 text-blue-600", icon: <CheckCircle className="h-4 w-4" /> },
  processing: { label: "Processing", color: "bg-purple-500/10 text-purple-600", icon: <Package className="h-4 w-4" /> },
  shipped: { label: "Shipped", color: "bg-indigo-500/10 text-indigo-600", icon: <Truck className="h-4 w-4" /> },
  delivered: { label: "Delivered", color: "bg-green-500/10 text-green-600", icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-600", icon: <XCircle className="h-4 w-4" /> },
  refunded: { label: "Refunded", color: "bg-gray-500/10 text-gray-600", icon: <XCircle className="h-4 w-4" /> },
};

interface OrderWithDetails extends Order {
  parts?: { part_name: string; image_url?: string | null } | null;
  buyer_profile?: PublicProfile | null;
  seller_profile?: PublicProfile | null;
}

const Orders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  const [shippingForm, setShippingForm] = useState({
    carrier: "",
    tracking: "",
  });

  const fetchOrders = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          parts(part_name, image_url)
        `)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for buyers and sellers
      const ordersList = data || [];
      const userIds = [...new Set(ordersList.flatMap((o) => [o.buyer_id, o.seller_id]))];

      let profilesById: Record<string, PublicProfile> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("public_profiles")
          .select("*")
          .in("id", userIds);

        if (profilesData) {
          profilesById = Object.fromEntries(profilesData.map((p) => [p.id, p]));
        }
      }

      const ordersWithProfiles: OrderWithDetails[] = ordersList.map((o) => ({
        ...o,
        buyer_profile: profilesById[o.buyer_id] || null,
        seller_profile: profilesById[o.seller_id] || null,
      }));

      setOrders(ordersWithProfiles);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      fetchOrders(session.user.id);
    };
    checkUser();
  }, [navigate, fetchOrders]);

  const sendOrderNotification = async (
    orderId: string,
    action: "created" | "shipped" | "delivered",
    trackingNumber?: string,
    shippingCarrier?: string
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke("send-order-notification", {
        body: { orderId, action, trackingNumber, shippingCarrier },
      });
    } catch (error) {
      console.error("Failed to send order notification:", error);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, additionalData?: Record<string, unknown>) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus, ...additionalData };

      if (newStatus === "shipped") {
        updateData.shipped_at = new Date().toISOString();
      } else if (newStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);

      if (error) throw error;

      // Send notification email
      if (newStatus === "shipped") {
        sendOrderNotification(
          orderId,
          "shipped",
          additionalData?.tracking_number as string,
          additionalData?.shipping_carrier as string
        );
      } else if (newStatus === "delivered") {
        sendOrderNotification(orderId, "delivered");
      }

      toast({
        title: "Order Updated",
        description: `Order status changed to ${newStatus}`,
      });

      if (user) fetchOrders(user.id);
      setShippingDialogOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update order",
      });
    }
  };

  const handleShipOrder = () => {
    if (!selectedOrder) return;
    updateOrderStatus(selectedOrder.id, "shipped", {
      shipping_carrier: shippingForm.carrier,
      tracking_number: shippingForm.tracking,
    });
  };

  const buyerOrders = orders.filter((o) => o.buyer_id === user?.id);
  const sellerOrders = orders.filter((o) => o.seller_id === user?.id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const OrderCard = ({ order, isSeller }: { order: OrderWithDetails; isSeller: boolean }) => {
    const status = STATUS_CONFIG[order.status || "pending"];
    const otherParty = isSeller ? order.buyer_profile : order.seller_profile;

    return (
      <Card className="hover:shadow-medium transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">
                {order.parts?.part_name || "Unknown Part"}
              </CardTitle>
              <CardDescription>
                {isSeller ? "Buyer" : "Seller"}: {otherParty?.full_name || "Unknown"}
              </CardDescription>
            </div>
            <Badge className={status.color}>
              <span className="flex items-center gap-1">
                {status.icon}
                {status.label}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Price</span>
            <span className="font-semibold">${order.final_price.toFixed(2)}</span>
          </div>

          {order.shipping_address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-muted-foreground">{order.shipping_address}</span>
            </div>
          )}

          {order.tracking_number && (
            <div className="p-2 bg-muted rounded text-sm">
              <p className="font-medium">{order.shipping_carrier}</p>
              <p className="text-muted-foreground">Tracking: {order.tracking_number}</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Created: {order.created_at ? new Date(order.created_at).toLocaleDateString() : "N/A"}
          </div>

          {isSeller && (
            <div className="flex gap-2 pt-2">
              {order.status === "pending" && (
                <Button size="sm" onClick={() => updateOrderStatus(order.id, "confirmed")}>
                  Confirm Order
                </Button>
              )}
              {order.status === "confirmed" && (
                <Button size="sm" onClick={() => updateOrderStatus(order.id, "processing")}>
                  Start Processing
                </Button>
              )}
              {order.status === "processing" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedOrder(order);
                    setShippingDialogOpen(true);
                  }}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Mark Shipped
                </Button>
              )}
            </div>
          )}

          {!isSeller && order.status === "shipped" && (
            <Button size="sm" onClick={() => updateOrderStatus(order.id, "delivered")}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm Delivery
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout user={user}>
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <ShoppingCart className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Orders & Sales</h1>
              <p className="text-muted-foreground">Track your purchases and sales</p>
            </div>
          </div>

          <Tabs defaultValue="purchases" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="purchases">
                My Purchases ({buyerOrders.length})
              </TabsTrigger>
              <TabsTrigger value="sales">
                My Sales ({sellerOrders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="purchases">
              {buyerOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No purchases yet</p>
                    <Button variant="outline" className="mt-4" onClick={() => navigate("/browse")}>
                      Browse Parts
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {buyerOrders.map((order) => (
                    <OrderCard key={order.id} order={order} isSeller={false} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sales">
              {sellerOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No sales yet</p>
                    <Button variant="outline" className="mt-4" onClick={() => navigate("/my-listings")}>
                      Manage Listings
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {sellerOrders.map((order) => (
                    <OrderCard key={order.id} order={order} isSeller={true} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={shippingDialogOpen} onOpenChange={setShippingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Shipping Details</DialogTitle>
            <DialogDescription>
              Enter the shipping carrier and tracking number.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="carrier">Shipping Carrier</Label>
              <Input
                id="carrier"
                placeholder="e.g., FedEx, UPS, USPS"
                value={shippingForm.carrier}
                onChange={(e) => setShippingForm((f) => ({ ...f, carrier: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking Number</Label>
              <Input
                id="tracking"
                placeholder="Enter tracking number"
                value={shippingForm.tracking}
                onChange={(e) => setShippingForm((f) => ({ ...f, tracking: e.target.value }))}
              />
            </div>
            <Button onClick={handleShipOrder} className="w-full">
              <Truck className="h-4 w-4 mr-2" />
              Mark as Shipped
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Orders;
