import { LayoutDashboard, Calendar } from "lucide-react";
import { Link, useLocation } from "wouter";

export function AppSidebar({ studioId }: { studioId: string }) {
  const [location] = useLocation();
  const items = [
    { label: "Dashboard", href: `/hub-dub/studio/${studioId}/dashboard`, icon: LayoutDashboard },
    { label: "Sessões", href: `/hub-dub/studio/${studioId}/sessions`, icon: Calendar },
  ];

  return (
    <aside className="w-64 border-r border-border/70 bg-background/90 backdrop-blur-sm">
      <nav className="p-4 space-y-1">
        {items.map((item) => {
          const active = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <button
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
