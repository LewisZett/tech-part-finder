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
      // Silently fail logging - don't disrupt user experience
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
          // Log failed login attempt
          await logSecurityEvent('login_failed', 'medium', undefined, {
            email,
            error_code: error.status,
            error_message: error.message,
          });
          throw error;
        }

        // Log successful login
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
          // Log failed signup attempt
          await logSecurityEvent('signup_failed', 'medium', undefined, {
            email,
            error_code: error.status,
            error_message: error.message,
          });
          throw error;
        }

        // Log successful signup
        if (data.user) {
          await logSecurityEvent('signup_success', 'low', data.user.id, {
            email: data.user.email,
            trade_type: tradeType,
          });
        }
        
        toast({
          title: "Account created!",
          description: "Welcome to PartsMatch Pro.",
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
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10"></div>
      <Card className="w-full max-w-md shadow-large relative z-10 glass-card glow-cyan">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center glow-cyan animate-pulse">
              <img src={logo} alt="PARTSPRO" className="h-12 w-12 object-contain" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            {isLogin ? "WELCOME BACK" : "JOIN THE NETWORK"}
          </CardTitle>
          <CardDescription className="text-foreground/70">
            {isLogin
              ? "Access your command center"
              : "Register for exclusive access"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground font-orbitron">FULL NAME</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="border-primary/30 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tradeType" className="text-foreground font-orbitron">YOUR TRADE</Label>
                  <Select value={tradeType} onValueChange={setTradeType} required={!isLogin}>
                    <SelectTrigger className="border-primary/30 focus:border-primary">
                      <SelectValue placeholder="Select your trade" />
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
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-orbitron">EMAIL</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-primary/30 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-orbitron">PASSWORD</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-primary/30 focus:border-primary"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "LOADING..." : isLogin ? "ACCESS" : "REGISTER"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:text-primary/80 transition-colors font-orbitron"
            >
              {isLogin
                ? "NEW USER? REGISTER HERE"
                : "EXISTING USER? LOGIN HERE"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;