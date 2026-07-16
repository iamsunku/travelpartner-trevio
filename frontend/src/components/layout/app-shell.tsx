"use client";

import { useEffect } from "react";
import { useAppStore, useAuthStore } from "@/store/app-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Footer } from "@/components/layout/footer";
import { GlobalSearch } from "@/components/layout/global-search";
import { useApiSync } from "@/hooks/use-api-sync";
import { DashboardView } from "@/components/views/dashboard";
import { FlightsView } from "@/components/views/flights";
import { HotelsView } from "@/components/views/hotels";
import { HolidayView } from "@/components/views/holiday";
import { CrmView } from "@/components/views/crm";
import { CustomersView } from "@/components/views/customers";
import { QuotationsView } from "@/components/views/quotations";
import { BookingsView } from "@/components/views/bookings";
import { PaymentsView } from "@/components/views/payments";
import { WalletView } from "@/components/views/wallet";
import { CommissionView } from "@/components/views/commission";
import { ReportsView } from "@/components/views/reports";
import { EmployeesView } from "@/components/views/employees";
import { TasksView } from "@/components/views/tasks";
import { SupportView } from "@/components/views/support";
import { NotificationsView } from "@/components/views/notifications";
import { SettingsView } from "@/components/views/settings";
import { AgenciesView } from "@/components/views/agencies";
import { BranchesView } from "@/components/views/branches";
import { ApiMarketplaceView } from "@/components/views/api-marketplace";
import { ApiManagementView } from "@/components/views/api-management";
import { MonitoringView } from "@/components/views/monitoring";
import { MarketingView } from "@/components/views/marketing";
import { CmsView } from "@/components/views/cms";
import { FinanceView } from "@/components/views/finance";
import { AuditLogsView } from "@/components/views/audit-logs";
import { AnalyticsView } from "@/components/views/analytics";
import { HotelProductsView } from "@/components/views/hotel-products";
import { ActivityPackagesView } from "@/components/views/activity-packages";
import { ProductApprovalsView } from "@/components/views/product-approvals";
import { AttendanceLeaveView } from "@/components/views/attendance-leave";
import type { ViewKey } from "@/types";
import { Construction } from "lucide-react";
import { canAccessView } from "@/lib/nav-config";

const VIEW_REGISTRY: Record<ViewKey, React.ComponentType> = {
  dashboard: DashboardView,
  flights: FlightsView,
  hotels: HotelsView,
  "hotel-products": HotelProductsView,
  "activity-packages": ActivityPackagesView,
  "product-approvals": ProductApprovalsView,
  holiday: HolidayView,
  customers: CustomersView,
  crm: CrmView,
  quotations: QuotationsView,
  bookings: BookingsView,
  payments: PaymentsView,
  wallet: WalletView,
  commission: CommissionView,
  reports: ReportsView,
  employees: EmployeesView,
  tasks: TasksView,
  support: SupportView,
  notifications: NotificationsView,
  settings: SettingsView,
  agencies: AgenciesView,
  branches: BranchesView,
  "api-marketplace": ApiMarketplaceView,
  "api-management": ApiManagementView,
  monitoring: MonitoringView,
  marketing: MarketingView,
  cms: CmsView,
  finance: FinanceView,
  "audit-logs": AuditLogsView,
  analytics: AnalyticsView,
  attendance: AttendanceLeaveView,
};

export function AppShell() {
  const { activeView, syncViewFromUrl } = useAppStore();
  const { user } = useAuthStore();

  useEffect(() => {
    syncViewFromUrl();
  }, [syncViewFromUrl]);

  useApiSync();

  if (!user) return null;
  const ViewComponent = canAccessView(user, activeView)
    ? VIEW_REGISTRY[activeView] || DashboardView
    : DashboardView;

  return (
    <div className="min-h-screen flex bg-background">
      <GlobalSearch />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <ViewComponent />
        </main>
        <Footer />
      </div>
    </div>
  );
}

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2A7BBD]/15 to-[#00A79D]/15 border border-border/80 flex items-center justify-center mb-4">
        <Construction className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">This module is being assembled.</p>
    </div>
  );
}
