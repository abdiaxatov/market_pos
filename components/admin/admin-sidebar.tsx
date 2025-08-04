"use client";

import React, { ReactElement, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MenuIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Settings,
  Clock,
  BarChart3,
  UserPlus,
  Table,
  LogOut,
  Coffee,
  Store,
  Warehouse,
  FileText,
  ClipboardList,
  ShieldPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "./admin-auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NavItem = memo(
  ({
    href,
    icon: Icon,
    title,
    isActive,
    isOpen,
    badge,
  }: {
    href: string;
    icon: ReactElement;
    title: string;
    isActive: boolean;
    isOpen: boolean;
    badge?: string;
  }) => (
    <div className="relative group">
      <Link
        href={href}
        className={cn(
          "relative flex items-center gap-3 rounded-xl px-2 py-2 transition-all duration-300 ease-in-out",
          isActive
            ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md"
            : "text-muted-foreground hover:bg-primary/5 hover:text-primary",
          isActive && "hover:from-primary hover:to-primary/80 hover:text-primary-foreground",
          !isOpen && "justify-center px-0 py-3",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          "active:scale-95 touch-manipulation"
        )}
      >
        <div className="relative">
          {/* @ts-ignore */}
          <Icon.type className={cn(
            "h-5 w-5 shrink-0 transition-transform duration-200",
            isActive && "drop-shadow-sm",
            "group-hover:scale-110"
          )} />
          {badge && !isOpen && (
            <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs bg-destructive border-background">
              {badge}
            </Badge>
          )}
        </div>
        {isOpen && (
          <div className="flex items-center justify-between w-full min-w-0">
            <span className="truncate font-medium">{title}</span>
            {badge && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {badge}
              </Badge>
            )}
            {isActive && (
              <ChevronRight className="h-4 w-4 ml-2 opacity-70" />
            )}
          </div>
        )}
        {!isOpen && (
          <div className="absolute left-full ml-3 px-2 py-2 bg-popover border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{title}</span>
              {badge && (
                <Badge variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              )}
            </div>
            <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-popover border-l border-b rotate-45"></div>
          </div>
        )}
      </Link>
    </div>
  )
);

NavItem.displayName = "NavItem";

export const AdminSidebar = memo(() => {
  const pathname = usePathname();
  const { open, openMobile, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const { userRole, signOut } = useAuth();

  React.useEffect(() => {
    if (openMobile) setOpenMobile(false);
    // eslint-disable-next-line
  }, [pathname]);

  const navItems = [
    {
      href: "/admin/dashboard",
      icon: <LayoutDashboard />,
      title: "Boshqaruv paneli",
      roles: ["admin"],
    },
    {
      href: "/admin/saboy",
      icon: <Store />,
      title: "Saboy",
      roles: ["admin"],
    },
    {
      href: "/admin/menu",
      icon: <Coffee />,
      title: "Menyu",
      roles: ["admin"],
    },
    {
      href: "/admin/tables",
      icon: <Table />,
      title: "Stollar",
      roles: ["admin"],
    },
    {
      href: "/admin/register-staff",
      icon: <UserPlus />,
      title: "Xodimlar",
      roles: ["admin"],
    },
    {
      href: "/admin/order-history",
      icon: <Clock />,
      title: "Buyurtmalar tarixi",
      roles: ["admin"],
    },
    {
      href: "/admin/category-orders",
      icon: <ClipboardList />,
      title: "kategoriyalari",
      roles: ["admin"],
    },
    {
      href: "/admin/order-modifications",
      icon: <FileText />,
      title: "Buyurtma o'zgartirishlari",
      roles: ["admin"],
    },
    {
      href: "/admin/stats",
      icon: <BarChart3 />,
      title: "Statistika",
      roles: ["admin"],
    },
        {
      href: "/admin/warehouse",
      icon: <Warehouse />,
      title: "Ombor",
      roles: ["admin"],
    },
    {
      href: "/admin/settings",
      icon: <Settings />,
      title: "Sozlamalar",
      roles: ["admin"],
    },
      {
      href: "/admin/blocked-users",
      icon: <ShieldPlus />,
      title: "Blocked Users",
      roles: ["admin"],
    },

  ];

  const filteredNavItems = userRole
    ? navItems.filter((item) => item.roles.includes(userRole.toLowerCase()))
    : [];

  // Sidebar width by breakpoint and state
  const sidebarWidth =
    isMobile
      ? "w-[220px]"
      : open
        ? "md:w-[220px] lg:w-[260px]"
        : "md:w-[64px] lg:w-[70px]";

  // Logout button width (for fixed bottom)
  const logoutWidth =
    isMobile
      ? "220px"
      : open
        ? "260px"
        : "70px";

  return (
    <>
      {/* Mobil/Planshet menyu tugmasi */}
      <Button
        onClick={toggleSidebar}
        variant="outline"
        size="icon"
        className="fixed left-4 top-4 z-50 md:left-6 md:top-6 lg:hidden shadow-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        aria-label="Toggle menu"
      >
        {openMobile ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </Button>

      {/* Mobil/Planshet sidebar backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity lg:hidden",
          openMobile ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpenMobile(false)}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen transition-all duration-300 ease-in-out md:sticky md:h-screen flex flex-col",
          "border-r border-border/50 bg-gradient-to-b from-background via-background/95 to-background/90",
          "backdrop-blur-md supports-[backdrop-filter]:bg-background/80",
          "shadow-2xl md:shadow-xl",
          sidebarWidth,
          isMobile
            ? (openMobile ? "translate-x-0" : "-translate-x-full")
            : ""
        )}
        style={{
          display: isMobile ? (openMobile ? "block" : "none") : "block",
        }}
      >
        {/* Header */}
        <div className={cn(
          "flex h-16 items-center border-b border-border/50 bg-background/60 backdrop-blur-sm px-4 transition-all duration-200",
          open || isMobile ? "justify-between" : "justify-center"
        )}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl ">
              <img
                src="/Logo.png"
                alt="Logo"
                className="h-10 w-10 object-cover rounded-full"
              />
            </div>
            {(open || isMobile) && (
              <div className="animate-in slide-in-from-left-2 duration-200">
                <h1 className=" font-bold bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
                  QARSILLAMA SOMSA
                </h1>
                <p className="text-xs text-muted-foreground/80 font-medium">Admin Panel</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className={cn("space-y-2 p-4", open || isMobile ? "" : "p-2")}>
            {filteredNavItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                title={item.title}
                isActive={pathname.startsWith(item.href)}
                isOpen={open || isMobile}
                badge={item.badge}
              />
            ))}
          </nav>
        </div>

        {/* Toggle button for planshet va desktop */}
        <Button
          onClick={toggleSidebar}
          variant="outline"
          size="icon"
          className={cn(
            // planshet va desktopda chiqadi
            "absolute -right-4 top-10 hidden md:flex h-9 w-9 rounded-full shadow-xl bg-background/95 border-2 border-border/50 hover:bg-background hover:border-primary/30 transition-all duration-200 hover:scale-105"
          )}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          tabIndex={0}
        >
          {open ? (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {/* Logout button: always fixed bottom, width responsive, collapsedda faqat icon */}
        <div
          className={cn(
            "w-full px-4 pb-4 pt-2 bg-background/80 border-t border-border/50",
            "fixed left-0 z-40",
            open || isMobile ? "md:w-[220px] lg:w-[260px]" : "md:w-[64px] lg:w-[70px]"
          )}
          style={{
            bottom: 0,
            width: logoutWidth,
            transition: "width 0.3s"
          }}
        >
          <Button
            variant="outline"
            className={cn(
              "w-full flex items-center gap-3 transition-all duration-200 touch-manipulation",
              "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive",
              "active:scale-95",
              !(open || isMobile) && "px-0 justify-center"
            )}
            onClick={signOut}
            tabIndex={0}
          >
            <LogOut className="h-4 w-4" />
            {(open || isMobile) && <span>Chiqish</span>}
          </Button>
        </div>
      </aside>
    </>
  );
});

AdminSidebar.displayName = "AdminSidebar";
