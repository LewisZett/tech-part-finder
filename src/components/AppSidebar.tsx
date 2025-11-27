import { 
  Home, 
  Search, 
  List, 
  MessageSquare, 
  FileText, 
  ShoppingCart, 
  Star, 
  Settings, 
  HelpCircle, 
  LogOut 
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Browse Market", url: "/browse", icon: Search },
  { title: "My Listings", url: "/my-listings", icon: List },
  { title: "Matches & Messages", url: "/matches", icon: MessageSquare, hasBadge: true },
  { title: "My Requests", url: "/my-requests", icon: FileText },
  { title: "Orders & Sales", url: "/orders", icon: ShoppingCart },
  { title: "Reviews & Ratings", url: "/reviews", icon: Star },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Help & Support", url: "/help", icon: HelpCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", session.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
        } else {
          setProfile({ full_name: null, email: session.user.email || null });
        }

        // Fetch unread messages count (messages where user is receiver)
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("receiver_id", session.user.id);
        
        setUnreadCount(count || 0);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out successfully",
    });
    navigate("/auth");
  };

  const isCollapsed = state === "collapsed";
  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"}>
      <SidebarContent className="flex flex-col h-full">
        {/* User Identity Section */}
        {!isCollapsed && (
          <SidebarGroup className="pt-4">
            <SidebarGroupContent className="px-4">
              <NavLink to="/profile" className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity">
                <Avatar className="h-12 w-12 border-2 border-teal">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-teal text-white font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-lg text-sidebar-foreground truncate">
                    {profile?.full_name || "User"}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {profile?.email || "No email"}
                  </span>
                </div>
              </NavLink>
              <Separator className="bg-sidebar-border" />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Navigation Items */}
        <SidebarGroup className="flex-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-12">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 rounded-lg transition-all ${
                          isActive
                            ? "bg-teal text-white font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-white" : "text-teal"}`} />
                          {!isCollapsed && (
                            <span className="flex-1">{item.title}</span>
                          )}
                          {!isCollapsed && item.hasBadge && unreadCount > 0 && (
                            <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout Section - Bottom */}
        <SidebarGroup className="mt-auto pb-4">
          <SidebarGroupContent className="px-4">
            <Separator className="bg-sidebar-border mb-4" />
            <button
              onClick={handleLogout}
              className={`w-full flex items-center justify-center gap-2 bg-destructive text-destructive-foreground font-bold py-3 rounded-lg hover:bg-destructive/90 transition-colors ${
                isCollapsed ? "px-2" : "px-4"
              }`}
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span>Logout</span>}
            </button>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
