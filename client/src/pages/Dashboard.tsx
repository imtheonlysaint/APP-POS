import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CreditCard,
  KeyRound,
  LayoutList,
  LogOut,
  Package,
  Plus,
  ShoppingCart,
  Tags,
  Users,
  Activity,
  Database,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import { analyticsApi, membersApi, ordersApi, productsApi } from '../api/api';
import { useAuth } from '../hooks/useAuth';
import type { AnalyticsSummary, SalesGraphPoint, TopProduct, Product, Order, Member } from '../types';
import ProductsTab from '../components/tabs/ProductsTab';
import CategoriesTab from '../components/tabs/CategoriesTab';
import MembersTab from '../components/tabs/MembersTab';
import OrdersTab from '../components/tabs/OrdersTab';
import StockTab from '../components/tabs/StockTab';
import UsersTab from '../components/tabs/UsersTab';
import ConfirmDialog from '../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type TabKey = 'overview' | 'products' | 'categories' | 'members' | 'orders' | 'stock' | 'users';

const TABS: { key: TabKey; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { key: 'overview', label: 'OVERVIEW', icon: BarChart3 },
  { key: 'products', label: 'PRODUCT_ARCHIVE', icon: Package },
  { key: 'categories', label: 'CATEGORY_INDEX', icon: Tags },
  { key: 'members', label: 'ENTITY_MEMBERS', icon: Users },
  { key: 'orders', label: 'ORDER_HISTORY', icon: LayoutList },
  { key: 'stock', label: 'INVENTORY_LEVELS', icon: Boxes },
  { key: 'users', label: 'OPERATOR_MANAGEMENT', icon: KeyRound, adminOnly: true },
];

const salesChartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'var(--foreground)',
  },
  orders: {
    label: 'Orders',
    color: 'oklch(0.556 0 0)',
  },
} satisfies ChartConfig;

const OverviewTab: React.FC<{ onTabChange: (tab: TabKey) => void }> = ({ onTabChange }) => {
  const { data: summary, isLoading: sumLoading, error: sumError } = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsApi.getSummary().then(r => r.data),
  });

  const { data: topProducts = [], isLoading: topLoading } = useQuery<TopProduct[]>({
    queryKey: ['analytics-top-products'],
    queryFn: () => analyticsApi.getTopProducts().then(r => r.data),
  });

  const { data: salesGraph = [], isLoading: graphLoading } = useQuery<SalesGraphPoint[]>({
    queryKey: ['analytics-sales-graph'],
    queryFn: () => analyticsApi.getSalesGraph().then(r => r.data),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll().then(r => r.data),
  });

  const { data: recentOrders = [] } = useQuery<Order[]>({
    queryKey: ['recent-orders'],
    queryFn: () => ordersApi.getAll().then(r => r.data.slice(0, 5)),
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: () => membersApi.getAll().then(r => r.data),
  });

  const lowStockProducts = products.flatMap(p =>
    p.variants.filter(v => v.currentStock <= 10 && v.currentStock >= 0).map(v => ({
      ...v,
      productName: p.name,
    })),
  ).slice(0, 5);

  const fmt = (n: number) => `Rp ${Number(n).toLocaleString('id-ID')}`;
  const compactCurrency = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return `${n}`;
  };
  const chartData = salesGraph.map(item => ({
    ...item,
    label: new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }).toUpperCase(),
  }));

  if (sumError) {
    return (
      <div className="border border-destructive bg-destructive/10 p-12 text-center">
        <AlertTriangle className="mx-auto mb-4 size-8 text-destructive" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-destructive">Analytics_Fetch_Error</h3>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-widest text-destructive/80">Insufficient permissions or server connection failure.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <Activity className="size-3" />
            <span>Systems_Performance_Monitor</span>
          </div>
          <h2 className="text-3xl font-bold uppercase tracking-tighter">Overview_Dashboard</h2>
        </div>
        <div className="flex flex-wrap gap-px bg-border border border-border">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => window.location.href = '/'} 
            className="rounded-none bg-card px-6 text-[10px] font-bold uppercase tracking-widest hover:bg-muted"
          >
            <ShoppingCart className="mr-2 size-3.5" />
            Launch_POS
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onTabChange('products')} 
            className="rounded-none bg-card px-6 text-[10px] font-bold uppercase tracking-widest hover:bg-muted"
          >
            <Plus className="mr-2 size-3.5" />
            Add_Resource
          </Button>
        </div>
      </div>

      <div className="grid gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="DAILY_REVENUE"
          value={sumLoading ? '---' : fmt(summary?.today?.revenue ?? 0)}
          sub={sumLoading ? '' : `PREV: ${fmt(summary?.yesterday?.revenue ?? 0)}`}
          positive={(summary?.today?.revenue ?? 0) >= (summary?.yesterday?.revenue ?? 0)}
          icon={CreditCard}
          index="01"
        />
        <StatCard
          label="ORDER_VOLUME"
          value={sumLoading ? '---' : String(summary?.today?.orders ?? 0)}
          sub={sumLoading ? '' : `PREV: ${summary?.yesterday?.orders ?? 0} UNIT`}
          positive={(summary?.today?.orders ?? 0) >= (summary?.yesterday?.orders ?? 0)}
          icon={LayoutList}
          index="02"
        />
        <StatCard
          label="AVERAGE_SETTLEMENT"
          value={sumLoading ? '---' : (
            (summary?.today?.orders ?? 0) > 0
              ? fmt((summary?.today?.revenue ?? 0) / (summary?.today?.orders ?? 1))
              : 'Rp 0'
          )}
          sub="REAL_TIME_CALC"
          icon={BarChart3}
          index="03"
        />
        <StatCard
          label="ENTITY_COUNT"
          value={String(members.length)}
          sub="REGISTERED_MEMBERS"
          icon={Users}
          index="04"
        />
      </div>

      <div className="grid gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">05_Sales_Trend_Archive</span>
            <span className="text-[9px] font-mono text-muted-foreground">7_DAY_CYCLE</span>
          </div>
          <div className="border border-border bg-card p-8">
            {graphLoading ? (
              <div className="py-20 text-center animate-pulse text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Querying_Data_Stream...</div>
            ) : (
              <ChartContainer config={salesChartConfig} className="h-80 w-full">
                <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="oklch(0.922 0 0)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={12}
                    className="text-[9px] font-mono font-bold"
                  />
                  <YAxis
                    yAxisId="revenue"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={12}
                    tickFormatter={compactCurrency}
                    className="text-[9px] font-mono font-bold"
                  />
                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    hide
                  />
                  <ChartTooltip
                    cursor={{ stroke: 'var(--foreground)', strokeWidth: 1 }}
                    content={
                      <ChartTooltipContent
                        className="rounded-none border-foreground"
                        indicator="line"
                      />
                    }
                  />
                  <Area
                    yAxisId="revenue"
                    dataKey="revenue"
                    type="stepAfter"
                    fill="var(--foreground)"
                    fillOpacity={0.05}
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                  />
                  <Area
                    yAxisId="orders"
                    dataKey="orders"
                    type="stepAfter"
                    fill="transparent"
                    stroke="oklch(0.556 0 0)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </div>
        </div>

        <div className="space-y-12">
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">06_Low_Inventory_Alerts</span>
              <Badge variant="outline" className="rounded-none border-orange-500/50 text-[9px] font-mono text-orange-600">CRITICAL</Badge>
            </div>
            <div className="divide-y divide-border border border-border bg-card">
              {lowStockProducts.length === 0 ? (
                <p className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inventory_Optimal.</p>
              ) : (
                <>
                  {lowStockProducts.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 transition-colors hover:bg-muted/30">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">REF_{item.sku}</span>
                        <span className="text-[11px] font-bold uppercase tracking-tight">{item.productName}</span>
                      </div>
                      <span className={cn(
                        "font-mono text-[10px] font-bold",
                        item.currentStock <= 3 ? "text-destructive" : "text-foreground"
                      )}>
                        {String(item.currentStock).padStart(2, '0')} UNIT
                      </span>
                    </div>
                  ))}
                  <button 
                    className="flex w-full items-center justify-center p-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => onTabChange('stock')}
                  >
                    View_Full_Inventory <ArrowRight className="ml-2 size-3" />
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">07_Recent_Settlements</span>
              <Database className="size-3 text-muted-foreground" />
            </div>
            <div className="divide-y divide-border border border-border bg-card">
              {recentOrders.length === 0 ? (
                <p className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Buffer_Empty.</p>
              ) : (
                <>
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 transition-colors hover:bg-muted/30">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">{order.orderNumber}</span>
                        <span className="text-[10px] font-bold uppercase tracking-tight">
                          {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {order.paymentMethod}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold">{fmt(order.totalAmount)}</span>
                    </div>
                  ))}
                  <button 
                    className="flex w-full items-center justify-center p-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => onTabChange('orders')}
                  >
                    Fetch_History <ArrowRight className="ml-2 size-3" />
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="space-y-4 pb-12">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">08_Top_Performing_Resources</span>
          <span className="text-[9px] font-mono text-muted-foreground uppercase">SORT_BY_VOLUME</span>
        </div>
        <div className="border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                <TableHead className="h-12 px-6 text-[10px] font-bold uppercase tracking-widest">Rank</TableHead>
                <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest">Resource_Description</TableHead>
                <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest">Reference</TableHead>
                <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest">Throughput</TableHead>
                <TableHead className="h-12 px-6 text-right text-[10px] font-bold uppercase tracking-widest">Net_Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Scanning_Manifests...</TableCell>
                </TableRow>
              ) : topProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">No_Data_In_Buffer.</TableCell>
                </TableRow>
              ) : (
                topProducts.map((item, idx) => (
                  <TableRow key={idx} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <TableCell className="px-6 font-mono text-[10px] font-bold text-muted-foreground">{(idx + 1).toString().padStart(2, '0')}</TableCell>
                    <TableCell className="text-[11px] font-bold uppercase tracking-tight">{item.productName}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground uppercase">{item.sku}</TableCell>
                    <TableCell className="text-[10px] font-bold uppercase">{item.totalSold} UNIT</TableCell>
                    <TableCell className="px-6 text-right text-[11px] font-bold">{fmt(item.totalRevenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  positive?: boolean;
  index: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon: Icon, positive, index }) => (
  <div className="bg-card p-8 transition-colors hover:bg-muted/10">
    <div className="mb-6 flex items-start justify-between">
      <div className="flex flex-col">
        <span className="text-[9px] font-mono text-muted-foreground">{index}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      </div>
      <div className="border border-border p-2">
        <Icon className="size-4 text-muted-foreground" />
      </div>
    </div>
    <div className="space-y-1">
      <div className="text-2xl font-bold tracking-tighter">{value}</div>
      <div className={cn(
        'text-[9px] font-bold uppercase tracking-widest',
        positive === undefined ? 'text-muted-foreground' : positive ? 'text-green-600' : 'text-destructive'
      )}>
        {sub}
      </div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin());

  return (
    <SidebarProvider>
      <Sidebar collapsible="none" className="border-r border-border bg-card">
        <SidebarHeader className="border-b border-border px-8 py-6">
          <div className="flex flex-col">
            <div className="text-xl font-bold uppercase tracking-[0.2em]">CAFE POS</div>
            <div className="mt-1 flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              <Terminal className="size-3" />
              <span>CORE_DASHBOARD_v1.0</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-4 py-8">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {visibleTabs.map(tab => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;
                  return (
                    <SidebarMenuItem key={tab.key}>
                      <SidebarMenuButton
                        type="button"
                        isActive={active}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                          'h-12 rounded-none px-4 text-[10px] font-bold uppercase tracking-widest transition-all',
                          active 
                            ? 'bg-foreground text-background hover:bg-foreground hover:text-background' 
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <Icon className="size-4" />
                        <span>{tab.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator className="mx-0" />
        
        <SidebarFooter className="p-8 space-y-6">
          <div className="border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              <ShieldCheck className="size-3" />
              <span>OPERATOR_CONTEXT</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-tight">{user?.username}</span>
              <span className="text-[9px] font-mono text-muted-foreground uppercase">{user?.role}</span>
            </div>
          </div>
          
          <div className="grid gap-px border border-border bg-border">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              className="rounded-none bg-card h-10 text-[9px] font-bold uppercase tracking-widest hover:bg-muted transition-colors" 
              onClick={() => window.location.href = '/'}
            >
              NAVIGATE_TO_POS
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              className="rounded-none bg-card h-10 text-[9px] font-bold uppercase tracking-widest text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all" 
              onClick={() => setIsLogoutDialogOpen(true)}
            >
              <LogOut className="size-3.5" />
              TERMINATE_SESSION
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="h-screen overflow-y-auto bg-background px-12 py-12">
        <div className="mx-auto max-w-7xl">
          {activeTab === 'overview' && <OverviewTab onTabChange={setActiveTab} />}
          {activeTab === 'products' && <ProductsTab />}
          {activeTab === 'categories' && <CategoriesTab />}
          {activeTab === 'members' && <MembersTab />}
          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'stock' && <StockTab />}
          {activeTab === 'users' && <UsersTab />}
        </div>
      </SidebarInset>

      <ConfirmDialog
        isOpen={isLogoutDialogOpen}
        onConfirm={logout}
        onCancel={() => setIsLogoutDialogOpen(false)}
        title="SESSION_TERMINATION"
        message="REQUESTING PERMISSION TO TERMINATE CURRENT OPERATOR SESSION. ANALYTICS DATA WILL BE PERSISTED."
        confirmLabel="AUTHORIZE_LOGOUT"
        confirmDanger
      />
    </SidebarProvider>
  );
};

export default Dashboard;
