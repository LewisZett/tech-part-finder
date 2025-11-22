import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Edit } from "lucide-react";

const Profile = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [stats, setStats] = useState({ parts: 0, requests: 0, matches: 0 });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
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

  const fetchProfile = async (userId: string) => {
    setLoading(true);
    
    const [profileResult, partsResult, requestsResult, matchesResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("parts").select("id", { count: "exact" }).eq("supplier_id", userId),
      supabase.from("part_requests").select("id", { count: "exact" }).eq("requester_id", userId),
      supabase.from("matches").select("id", { count: "exact" }).or(`supplier_id.eq.${userId},requester_id.eq.${userId}`)
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data);
      setFullName(profileResult.data.full_name || "");
      setTradeType(profileResult.data.trade_type || "");
      setPhoneNumber(profileResult.data.phone_number || "");
    }

    setStats({
      parts: partsResult.count || 0,
      requests: requestsResult.count || 0,
      matches: matchesResult.count || 0
    });

    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          trade_type: tradeType,
          phone_number: phoneNumber || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Profile updated!",
        description: "Your profile has been successfully updated.",
      });
      setEditing(false);
      fetchProfile(user.id);
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
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-primary text-center">PROFILE</h1>
        <p className="text-muted-foreground mb-6 text-center font-rajdhani text-lg">MANAGE YOUR ACCOUNT</p>

        <Card className="bg-card/95 backdrop-blur-sm border-primary/20 shadow-large mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center shadow-medium">
                  <User className="h-8 w-8 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-primary font-orbitron">{profile?.full_name || "USER"}</CardTitle>
                  <CardDescription className="text-muted-foreground font-rajdhani">{profile?.email}</CardDescription>
                </div>
              </div>
              {!editing && (
                <Button variant="outline" onClick={() => setEditing(true)} className="w-full sm:w-auto">
                  <Edit className="mr-2 h-4 w-4" />
                  EDIT
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground font-orbitron">FULL NAME</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="border-primary/30 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tradeType" className="text-foreground font-orbitron">TRADE TYPE</Label>
                  <Select value={tradeType} onValueChange={setTradeType}>
                    <SelectTrigger className="border-primary/30 focus:border-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-primary/30">
                      <SelectItem value="phone_repair">Phone Repair</SelectItem>
                      <SelectItem value="computer_tech">Computer Tech</SelectItem>
                      <SelectItem value="car_mechanic">Car Mechanic</SelectItem>
                      <SelectItem value="hvac">HVAC</SelectItem>
                      <SelectItem value="appliance_repair">Appliance Repair</SelectItem>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="general">General/Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-foreground font-orbitron">PHONE NUMBER</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="border-primary/30 focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground font-rajdhani">
                    International format (e.g., +1234567890). Optional - for WhatsApp notifications.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleUpdateProfile} className="w-full sm:w-auto">SAVE</Button>
                  <Button variant="outline" onClick={() => setEditing(false)} className="w-full sm:w-auto">CANCEL</Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground font-orbitron">EMAIL</Label>
                  <p className="text-lg text-foreground font-rajdhani">{profile?.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground font-orbitron">TRADE TYPE</Label>
                  <p className="text-lg text-foreground font-rajdhani capitalize">{profile?.trade_type?.replace("_", " ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground font-orbitron">PHONE NUMBER</Label>
                  <p className="text-lg text-foreground font-rajdhani">{profile?.phone_number || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground font-orbitron">VERIFIED</Label>
                  <p className="text-lg text-foreground font-rajdhani">{profile?.is_verified ? "Yes" : "No"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground font-orbitron">MEMBER SINCE</Label>
                  <p className="text-lg text-foreground font-rajdhani">
                    {new Date(profile?.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/95 backdrop-blur-sm border-secondary/20 shadow-large">
          <CardHeader>
            <CardTitle className="text-secondary font-orbitron text-center text-2xl">ACCOUNT STATS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/30">
                <p className="text-sm text-muted-foreground font-orbitron mb-2">PARTS LISTED</p>
                <p className="text-3xl font-bold text-primary">{stats.parts}</p>
              </div>
              <div className="text-center p-4 bg-secondary/10 rounded-lg border border-secondary/30">
                <p className="text-sm text-muted-foreground font-orbitron mb-2">REQUESTS MADE</p>
                <p className="text-3xl font-bold text-secondary">{stats.requests}</p>
              </div>
              <div className="text-center p-4 bg-accent/10 rounded-lg border border-accent/30">
                <p className="text-sm text-muted-foreground font-orbitron mb-2">MATCHES</p>
                <p className="text-3xl font-bold text-accent">{stats.matches}</p>
              </div>
              <div className="text-center p-4 bg-muted/20 rounded-lg border border-muted">
                <p className="text-sm text-muted-foreground font-orbitron mb-2">RATING</p>
                <p className="text-3xl font-bold text-muted-foreground">N/A</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Profile;