"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronDown, Menu, User, LogOut, Settings, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MobileSidebar } from "./Sidebar";

const breadcrumbMap: Record<string, string> = {
  dashboard: "Dashboard",
  inspection: "Inspection",
  new: "New Inspection",
  history: "Inspection History",
  reports: "Reports",
  analytics: "Analytics",
  rules: "Rules & Requirements",
};

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [
    { label: "Statera", href: "/dashboard" },
  ];
  let currentPath = "";
  for (const seg of segments) {
    currentPath += `/${seg}`;
    const label = breadcrumbMap[seg] ?? (seg.startsWith("INS-") ? seg : seg.startsWith("RPT-") ? seg : "Detail");
    crumbs.push({ label, href: currentPath });
  }
  return crumbs;
}

function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/inspection/new")) return "New Inspection";
  if (pathname.startsWith("/history/")) return "Inspection Detail";
  if (pathname === "/history") return "Inspection History";
  if (pathname.startsWith("/reports/")) return "Report Preview";
  if (pathname === "/reports") return "Reports";
  if (pathname === "/analytics") return "Analytics";
  if (pathname === "/rules") return "Rules & Requirements";
  return "Statera";
}

export function Header() {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const crumbs = getBreadcrumbs(pathname);
  const title = getPageTitle(pathname);

  return (
    <>
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-card/80 backdrop-blur-sm px-4 lg:px-6 gap-4">
        {/* Mobile menu */}
        <button
          className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Title + breadcrumb */}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
          <nav className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                {i === crumbs.length - 1 ? (
                  <span className="text-foreground font-medium truncate max-w-[200px]">{c.label}</span>
                ) : (
                  <Link href={c.href} className="hover:text-foreground transition-colors truncate max-w-[120px]">
                    {c.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card" />
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-popover shadow-lg z-50">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold">Notifications</p>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { title: "Inspection INS-2024-0089 awaiting verification", time: "2h ago", unread: true },
                    { title: "Inspection INS-2024-0087 needs further review", time: "5h ago", unread: true },
                    { title: "Report RPT-2024-0090 generated", time: "Yesterday", unread: false },
                  ].map((n, i) => (
                    <div key={i} className={cn("px-4 py-3 hover:bg-muted cursor-pointer", n.unread && "bg-primary/5")}>
                      <p className="text-xs font-medium text-foreground leading-snug">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-border">
                  <button className="text-xs text-primary hover:underline">View all</button>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
            >
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold">
                RK
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-foreground leading-tight">Rajesh Kumar</p>
                <p className="text-[10px] text-muted-foreground">INS-DL-042</p>
              </div>
              <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-popover shadow-lg z-50">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">Rajesh Kumar</p>
                  <p className="text-xs text-muted-foreground">rajesh.kumar@statera.gov.in</p>
                </div>
                <div className="py-1">
                  {[
                    { icon: User, label: "Profile" },
                    { icon: Settings, label: "Settings" },
                  ].map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="border-t border-border py-1">
                  <button className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Click outside to close dropdowns */}
        {(notifOpen || profileOpen) && (
          <div className="fixed inset-0 z-40" onClick={() => { setNotifOpen(false); setProfileOpen(false); }} />
        )}
      </header>
    </>
  );
}
