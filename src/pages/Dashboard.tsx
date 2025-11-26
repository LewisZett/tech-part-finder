import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Zap, Shield, CheckCircle } from "lucide-react";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-primary font-orbitron text-xl">LOADING...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout user={user}>
      <div className="container mx-auto px-4 py-12 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground font-orbitron">
            Welcome to PartMatch
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The smart marketplace connecting spares/parts suppliers and buyers
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6 max-w-3xl mx-auto">
            <Button 
              size="lg" 
              onClick={() => navigate("/browse")}
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground text-xl py-8 px-12 h-auto font-bold shadow-large hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              Find Parts Now
            </Button>
            <Button 
              size="lg" 
              onClick={() => navigate("/my-listings")}
              className="bg-orange hover:bg-orange/90 text-orange-foreground text-xl py-8 px-12 h-auto font-bold shadow-large hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              Start Selling Parts
            </Button>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground font-orbitron mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started in just four simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="pt-8 pb-6 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm mb-2">
                    1
                  </div>
                  <h3 className="text-xl font-semibold text-foreground font-orbitron">
                    List or Request Parts
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Add parts you want to sell or create requests for parts you need
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="pt-8 pb-6 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm mb-2">
                    2
                  </div>
                  <h3 className="text-xl font-semibold text-foreground font-orbitron">
                    Get Matched Instantly
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Our system automatically connects buyers with suppliers
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="pt-8 pb-6 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm mb-2">
                    3
                  </div>
                  <h3 className="text-xl font-semibold text-foreground font-orbitron">
                    Connect Securely
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Chat safely in-app - contact info is shared only when both parties agree
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Step 4 */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="pt-8 pb-6 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm mb-2">
                    4
                  </div>
                  <h3 className="text-xl font-semibold text-foreground font-orbitron">
                    Complete the Deal
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Finalize your transaction and rate your experience
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
