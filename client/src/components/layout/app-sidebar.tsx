import { memo, useMemo } from "react";
import {
  Building2, Calendar, Film, LayoutDashboard,
  Settings, Users, LogOut, Bell, ShieldCheck, Music
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useStudio } from "@/hooks/use-studios";
import { useAuth } from "@/hooks/use-auth";
import { useStudioRole } from "@/hooks/use-studio-role";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { pt } from "@/lib/i18n";

interface AppSidebarProps {
  studioId: string;
}

export const AppSidebar = memo(function AppSidebar({ studioId }: AppSidebarProps) {
  const [location] = useLocation();
  const studio = useStudio(studioId);
  const { user, logout } = useAuth();
  const { canManageMembers, canViewStaff, hasMinRole } = useStudioRole(studioId);

  const { data: unreadCount } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: () => authFetch("/api/notifications/unread-count"),
    refetchInterval: 30000,
  });

  const isStudioAdmin = user?.role === "platform_owner" || hasMinRole("studio_admin");

  const navItems = useMemo(() => {
    const items = [
      { title: pt.nav.dashboard, url: `/studio/${studioId}/dashboard`, icon: LayoutDashboard },
    ];
    items.push({ title: pt.nav.productions, url: `/studio/${studioId}/productions`, icon: Film });
    items.push({ title: pt.nav.sessions, url: `/studio/${studioId}/sessions`, icon: Calendar });
    if (isStudioAdmin) {
      items.push({ title: pt.nav.takes, url: `/studio/${studioId}/takes`, icon: Music });
    }
    if (canManageMembers) {
      items.push({ title: pt.nav.members, url: `/studio/${studioId}/members`, icon: Users });
    }
    if (canViewStaff) {
      items.push({ title: pt.nav.staff, url: `/studio/${studioId}/staff`, icon: Users });
    }
    return items;
  }, [studioId, canManageMembers, canViewStaff, isStudioAdmin]);

  const activeItemClass = "bg-gradient-to-r from-primary/20 to-accent/10 text-primary font-medium border-l-2 border-l-primary";
  const inactiveItemClass = "text-sidebar-foreground/70 border-l-2 border-l-transparent";

  return (
    <Sidebar className="vhub-sidebar">
      <SidebarHeader className="py-5 px-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="V.HUB" className="h-8 w-8" data-testid="img-logo-sidebar" />
          <span className="font-bold tracking-tight gradient-text text-lg" data-testid="text-brand-name">V.HUB</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-2 mb-1">
            {studio?.name || "Estudio"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={`h-8 rounded-md transition-all duration-150 ${
                        isActive ? activeItemClass : inactiveItemClass
                      }`}
                    >
                      <Link href={item.url} className="flex items-center gap-2.5 px-2">
                        <item.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-2 mb-1">
            {pt.nav.platform}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === `/studio/${studioId}/notifications`}
                  className={`h-8 rounded-md transition-all duration-150 ${
                    location === `/studio/${studioId}/notifications`
                      ? activeItemClass
                      : inactiveItemClass
                  }`}
                >
                  <Link href={`/studio/${studioId}/notifications`} className="flex items-center gap-2.5 px-2">
                    <Bell className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm">{pt.notifications.title}</span>
                    {(unreadCount?.count ?? 0) > 0 && (
                      <span className="ml-auto bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center" data-testid="badge-unread-count">
                        {unreadCount.count}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isStudioAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === `/studio/${studioId}/admin`}
                    className={`h-8 rounded-md transition-all duration-150 ${
                      location === `/studio/${studioId}/admin`
                        ? activeItemClass
                        : inactiveItemClass
                    }`}
                  >
                    <Link href={`/studio/${studioId}/admin`} className="flex items-center gap-2.5 px-2" data-testid="link-studio-admin">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-sm">Painel Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {user?.role === "platform_owner" && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin"}
                    className={`h-8 rounded-md transition-all duration-150 ${
                      location === "/admin"
                        ? activeItemClass
                        : inactiveItemClass
                    }`}
                  >
                    <Link href="/admin" className="flex items-center gap-2.5 px-2" data-testid="link-platform-admin">
                      <Settings className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-sm">{pt.nav.admin}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/[0.08] p-2">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-8 rounded-md text-sidebar-foreground/60 border-l-2 border-l-transparent transition-all duration-150">
              <Link href="/studios" className="flex items-center gap-2.5 px-2" data-testid="link-switch-studio">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="text-sm">{pt.auth.switchStudio}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              className="h-8 rounded-md text-red-500/70 border-l-2 border-l-transparent transition-all duration-150 flex items-center gap-2.5 px-2 w-full"
              data-testid="button-logout"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="text-sm">{pt.auth.signOut}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
});
