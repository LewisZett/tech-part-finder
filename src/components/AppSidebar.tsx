import { Home, List, MessageSquare, User, LogOut, Search, Package, FileText, Users } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
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
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchStats(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchStats(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
        {!isCollapsed && user && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground text-sm font-orbitron">
              Account Stats
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-4 py-2 space-y-3">
                <div className="flex items-center gap-3 text-sidebar-foreground">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm">Parts Listed:</span>
                  <span className="ml-auto text-sm font-semibold">{stats.parts}</span>
                </div>
                <div className="flex items-center gap-3 text-sidebar-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm">Requests Made:</span>
                  <span className="ml-auto text-sm font-semibold">{stats.requests}</span>
                </div>
                <div className="flex items-center gap-3 text-sidebar-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm">Matches:</span>
                  <span className="ml-auto text-sm font-semibold">{stats.matches}</span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
