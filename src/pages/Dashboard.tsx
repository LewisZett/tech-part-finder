import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { CategoryHero } from "@/components/CategoryHero";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Zap, Shield, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-64 w-full mb-8 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout user={user}>
      <CategoryHero />

      <div className="container mx-auto px-4 py-12 space-y-16">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">
            Zimbabwe's Spare Parts Marketplace – Phones • TVs • Laptops • Cars
          </p>
        </div>

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
            <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="pt-8 pb-6 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto group-hover:scale-105 transition-transform duration-300">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm mb-2">
                    1
                  </div>
                  <h3 className="text-xl font-semibold text-foreground font-orbitron">
                    List or Request
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Add spare parts you want to sell or create requests for parts you need
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="pt-8 pb-6 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto group-hover:scale-105 transition-transform duration-300">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm mb-2">
                    2
                  </div>
                  <h3 className="text-xl font-semibold text-foreground font-orbitron">
                    Get Matched
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Our system automatically connects buyers with suppliers
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="pt-8 pb-6 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto group-hover:scale-105 transition-transform duration-300">
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
                    Chat safely in-app – contact info is shared only when both parties agree
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="pt-8 pb-6 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto group-hover:scale-105 transition-transform duration-300">
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
