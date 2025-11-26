import { Home, List, MessageSquare, User, LogOut, Search, Package, FileText, Handshake } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "BROWSE MARKET", url: "/browse", icon: Search },
  { title: "My Listings", url: "/my-listings", icon: List },
  { title: "Matches & Messages", url: "/matches", icon: MessageSquare },
  { title: "PROFILE", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({ parts: 0, requests: 0, matches: 0 });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      const [partsResult, requestsResult, matchesResult] = await Promise.all([
        supabase.from("parts").select("*", { count: "exact", head: true }).eq("supplier_id", userId),
        supabase.from("part_requests").select("*", { count: "exact", head: true }).eq("requester_id", userId),
        supabase.from("matches").select("*", { count: "exact", head: true }).or(`requester_id.eq.${userId},supplier_id.eq.${userId}`)
      ]);

      setStats({
        parts: partsResult.count || 0,
        requests: requestsResult.count || 0,
        matches: matchesResult.count || 0,
      });
    };

    fetchStats();
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out successfully",
    });
    navigate("/auth");
  };

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!isCollapsed && (
          <SidebarGroup>
            <SidebarGroupContent className="px-4">
              <Card className="bg-sidebar-accent/50 border-sidebar-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-sidebar-primary" />
                      <span className="text-sm text-sidebar-foreground">Parts</span>
                    </div>
                    <span className="text-lg font-bold text-sidebar-primary">{stats.parts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-sidebar-primary" />
                      <span className="text-sm text-sidebar-foreground">Requests</span>
                    </div>
                    <span className="text-lg font-bold text-sidebar-primary">{stats.requests}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Handshake className="h-4 w-4 text-sidebar-primary" />
                      <span className="text-sm text-sidebar-foreground">Matches</span>
                    </div>
                    <span className="text-lg font-bold text-sidebar-primary">{stats.matches}</span>
                  </div>
                </CardContent>
              </Card>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                  {!isCollapsed && <span>Logout</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
