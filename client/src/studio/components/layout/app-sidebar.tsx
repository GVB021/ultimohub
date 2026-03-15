import { memo, useMemo } from "react";
import {
  Building2, Calendar, Film, LayoutDashboard,
  Settings, Users, LogOut, ShieldCheck, Music, UserCircle
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@studio/components/ui/sidebar";
import { useStudio } from "@studio/hooks/use-studios";
import { useAuth } from "@studio/hooks/use-auth";
import { useStudioRole } from "@studio/hooks/use-studio-role";
import { pt } from "@studio/lib/i18n";
import { RoleBadge } from "@studio/components/ui/design-system";

interface AppSidebarProps {
  studioId: string;
}

export const AppSidebar = memo(function AppSidebar({ studioId }: AppSidebarProps) {
  const { setOpen, isMobile } = useSidebar();
  const [location] = useLocation();
  const studio = useStudio(studioId);
  const { user, logout } = useAuth();
  const { canManageMembers, canViewStaff, hasMinRole, role } = useStudioRole(studioId);

  const isStudioAdmin = user?.role === "platform_owner" || hasMinRole("studio_admin");
  const isRestrictedRole = !hasMinRole("diretor");

  const navItems = useMemo(() => {
    const items = [
      { title: pt.nav.dashboard, url: `/hub-dub/studio/${studioId}/dashboard`, icon: LayoutDashboard },
      { title: pt.nav.sessions, url: `/hub-dub/studio/${studioId}/sessions`, icon: Calendar },
    ];
    if (!isRestrictedRole) {
      items.push({ title: pt.nav.productions, url: `/hub-dub/studio/${studioId}/productions`, icon: Film });
    }
    if (isStudioAdmin) {
      items.push({ title: pt.nav.takes, url: `/hub-dub/studio/${studioId}/takes`, icon: Music });
    }
    if (canManageMembers) {
      items.push({ title: pt.nav.members, url: `/hub-dub/studio/${studioId}/members`, icon: Users });
    }
    if (canViewStaff) {
      items.push({ title: pt.nav.staff, url: `/hub-dub/studio/${studioId}/staff`, icon: Users });
    }
    return items;
  }, [studioId, canManageMembers, canViewStaff, isStudioAdmin, isRestrictedRole]);

  const activeItemClass = "bg-primary/12 text-foreground font-medium border border-primary/30";
  const inactiveItemClass = "text-muted-foreground/80 hover:bg-muted/70 hover:text-foreground transition-colors";

  return (
    <Sidebar
      className="border-r border-border/60 bg-background/72 backdrop-blur-lg shadow-sm z-20"
      collapsible="icon"
      onMouseEnter={() => {
        if (!isMobile) setOpen(true);
      }}
      onMouseLeave={() => {
        if (!isMobile) setOpen(false);
      }}
      onFocusCapture={() => {
        if (!isMobile) setOpen(true);
      }}
      onBlurCapture={(event) => {
        if (!isMobile && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <SidebarHeader className="py-6 px-4 border-b border-border/60">
        <div className="flex items-center gap-3 transition-all duration-300 group-data-[collapsible=icon]:justify-center">
          <div className="h-9 w-9 rounded-xl border border-border/70 bg-card/70 flex items-center justify-center">
            <img src="/logo.svg" alt="V.HUB" className="h-6 w-6" data-testid="img-logo-sidebar" />
          </div>
          <span className="font-semibold tracking-tight text-base text-foreground group-data-[collapsible=icon]:hidden" data-testid="text-brand-name">V.HUB</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-6 gap-6 custom-scrollbar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold text-muted-foreground/40 px-4 mb-3 uppercase tracking-[0.2em] group-data-[collapsible=icon]:hidden">
            {studio?.name || "Estúdio"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || location.startsWith(item.url + "?");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={`h-10 rounded-lg transition-colors mb-1 border border-transparent ${
                        isActive ? activeItemClass : inactiveItemClass
                      }`}
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-3">
                        <item.icon className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isActive ? "scale-110 text-primary" : "text-muted-foreground group-hover:text-white"}`} />
                        <span className="text-sm tracking-wide">{item.title}</span>
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
              {isStudioAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === `/hub-dub/studio/${studioId}/admin`}
                    className={`h-8 rounded-md transition-all duration-150 ${
                      location === `/hub-dub/studio/${studioId}/admin`
                        ? activeItemClass
                        : inactiveItemClass
                    }`}
                  >
                    <Link href={`/hub-dub/studio/${studioId}/admin`} className="flex items-center gap-2.5 px-2" data-testid="link-studio-admin">
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
                    isActive={location === "/hub-dub/admin"}
                    className={`h-8 rounded-md transition-all duration-150 ${
                      location === "/hub-dub/admin"
                        ? activeItemClass
                        : inactiveItemClass
                    }`}
                  >
                    <Link href="/hub-dub/admin" className="flex items-center gap-2.5 px-2" data-testid="link-platform-admin">
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
        {user && (
          <div className="px-2 pb-2 mb-2 border-b border-sidebar-border">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {user.displayName || user.fullName || user.email}
            </p>
            {role && <RoleBadge role={role} className="mt-1.5" />}
          </div>
        )}
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/hub-dub/profile"}
              className={`h-8 rounded-md transition-all duration-150 ${
                location === "/hub-dub/profile" ? activeItemClass : "text-sidebar-foreground/60 border-l-2 border-l-transparent"
              }`}
            >
              <Link href="/hub-dub/profile" className="flex items-center gap-2.5 px-2" data-testid="link-profile">
                <UserCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="text-sm">{pt.nav.profile}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-8 rounded-md text-sidebar-foreground/60 border-l-2 border-l-transparent transition-all duration-150">
              <Link href="/hub-dub/studios" className="flex items-center gap-2.5 px-2" data-testid="link-switch-studio">
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
