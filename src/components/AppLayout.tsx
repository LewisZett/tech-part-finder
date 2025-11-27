import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Navbar from "@/components/Navbar";
import { CategorySwitcher } from "@/components/CategorySwitcher";

interface AppLayoutProps {
  user: any;
  children: ReactNode;
  showCategorySwitcher?: boolean;
}

export function AppLayout({ user, children, showCategorySwitcher = true }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          <Navbar user={user} />
          {showCategorySwitcher && <CategorySwitcher />}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
