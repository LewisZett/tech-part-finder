import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/gear-puzzle-icon.png";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters").optional(),
  tradeType: z.string().min(1, "Please select your trade").optional(),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const logSecurityEvent = async (
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    userId?: string,
    details?: Record<string, any>
  ) => {
    try {
      await supabase.functions.invoke('log-security-event', {
        body: {
          event: {
            user_id: userId,
            event_type: eventType,
            event_category: 'authentication',
            severity,
            details,
          },
        },
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const validation = authSchema.pick({ email: true, password: true }).safeParse({ email, password });
        if (!validation.success) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: validation.error.errors[0].message,
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
          await logSecurityEvent('login_failed', 'medium', undefined, {
            email,
            error_code: error.status,
            error_message: error.message,
          });
          throw error;
        }

        if (data.user) {
          await logSecurityEvent('login_success', 'low', data.user.id, {
            email: data.user.email,
          });
        }
        
        toast({
          title: "Welcome back!",
          description: "You've successfully logged in.",
        });
      } else {
        const validation = authSchema.safeParse({ email, password, fullName, tradeType });
        if (!validation.success) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: validation.error.errors[0].message,
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
              trade_type: tradeType,
            },
          },
        });
        
        if (error) {
          await logSecurityEvent('signup_failed', 'medium', undefined, {
            email,
            error_code: error.status,
            error_message: error.message,
          });
          throw error;
        }

        if (data.user) {
          await logSecurityEvent('signup_success', 'low', data.user.id, {
            email: data.user.email,
            trade_type: tradeType,
          });
        }
        
        toast({
          title: "Account created!",
          description: "Welcome to PartsPro.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: error.message || "An error occurred during authentication",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5"></div>
      <Card className="w-full max-w-md shadow-large relative z-10">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
              <img src={logo} alt="PartsPro" className="h-12 w-12 object-contain" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            {isLogin ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isLogin
              ? "Sign in to access your dashboard"
              : "Join Zimbabwe's spare parts marketplace"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="border-border focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tradeType">Your Trade</Label>
                  <Select value={tradeType} onValueChange={setTradeType} required={!isLogin}>
                    <SelectTrigger className="border-border focus:border-primary">
                      <SelectValue placeholder="Select your trade" />
                    </SelectTrigger>
                    <SelectContent>
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
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-border focus:border-primary"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
