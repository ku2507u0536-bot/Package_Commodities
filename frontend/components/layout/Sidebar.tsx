"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plus,
  History,
  FileText,
  BarChart2,
  BookOpen,
  Scale,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Inspection", href: "/inspection/new", icon: Plus },
  { label: "Inspection History", href: "/history", icon: History },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "Rules & Requirements", href: "/rules", icon: BookOpen },
];

interface SidebarContentProps {
  onClose?: () => void;
}

function SidebarContent({ onClose }: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/statera-logo.jpg" alt="Statera Logo" className="h-9 w-auto object-contain rounded" />
          <div>
            <div className="text-sm font-bold text-foreground tracking-tight">Statera</div>
            <div className="text-[10px] text-muted-foreground leading-tight">Inspection System</div>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {nav.map(({ label, href, icon: Icon }) => {
          const isNew = href === "/inspection/new";
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isNew
                  ? "border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
              {isNew && !isActive && (
                <span className="ml-auto text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  START
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-4">
        <div className="rounded-lg bg-muted px-3 py-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Inspector ID</p>
          <p className="text-xs font-semibold text-foreground">INS-DL-042</p>
          <p className="text-[11px] text-muted-foreground">Rajesh Kumar</p>
          <p className="text-[10px] text-muted-foreground mt-1">Delhi Region · Active</p>
        </div>
      </div>
    </div>
  );
}

// Desktop sidebar (always visible)
export function Sidebar() {
  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card h-screen sticky top-0">
      <SidebarContent />
    </aside>
  );
}

// Mobile drawer
interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border shadow-xl transition-transform duration-300 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent onClose={onClose} />
      </div>
    </>
  );
}
