import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AnimatedMenuIcon } from "@/components/AnimatedMenuIcon";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/gear-puzzle-icon.png";
import { Package, FileText, Users } from "lucide-react";

interface NavbarProps {
  user: any;
}

const Navbar = ({ user }: NavbarProps) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ parts: 0, requests: 0, matches: 0 });

  useEffect(() => {
    if (user?.id) {
      fetchStats(user.id);
    }
  }, [user?.id]);

  const fetchStats = async (userId: string) => {
    const [partsResult, requestsResult, matchesResult] = await Promise.all([
      supabase.from("parts").select("id", { count: "exact" }).eq("supplier_id", userId),
      supabase.from("part_requests").select("id", { count: "exact" }).eq("requester_id", userId),
      supabase.from("matches").select("id", { count: "exact" }).or(`supplier_id.eq.${userId},requester_id.eq.${userId}`)
    ]);

    setStats({
      parts: partsResult.count || 0,
      requests: requestsResult.count || 0,
      matches: matchesResult.count || 0
    });
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm shadow-medium">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {user && <AnimatedMenuIcon />}
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-xl font-bold text-primary font-orbitron"
            >
              <img src={logo} alt="PARTSPRO logo" className="h-6 w-6 object-contain" />
              PARTSPRO
            </button>
          </div>
          
          {user ? (
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-6">
                <div className="flex items-center gap-2 text-foreground/80">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{stats.parts}</span>
                  <span className="text-xs">Parts</span>
                </div>
                <div className="flex items-center gap-2 text-foreground/80">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{stats.requests}</span>
                  <span className="text-xs">Requests</span>
                </div>
                <div className="flex items-center gap-2 text-foreground/80">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{stats.matches}</span>
                  <span className="text-xs">Matches</span>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate("/auth")}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
            >
              SIGN IN
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
