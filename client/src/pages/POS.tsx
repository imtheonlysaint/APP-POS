import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShoppingCart, 
  LogOut, 
  LayoutDashboard, 
  Search, 
  Barcode, 
  X, 
  Plus, 
  Minus, 
  Bell, 
  Banknote, 
  CreditCard, 
  Wallet, 
  Users,
  Box,
  Hash
} from 'lucide-react';
import { toast } from 'sonner';
import api, { productsApi, membersApi, ordersApi, SERVER_URL } from '../api/api';
import { useAuth } from '../hooks/useAuth';
import ReceiptModal from '../components/ReceiptModal';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Product, Variant, CartItem, Member, Order } from '../types';
import { getErrorMessage } from '../utils/error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const TEMP_LABELS: Record<string, string> = {
  HOT: 'Hot',
  ICED: 'Iced',
};

const SIZE_ORDER = ['SMALL', 'MEDIUM', 'LARGE'];
const TEMP_ORDER = ['HOT', 'ICED'];
type VariantOption = NonNullable<Variant['size']> | NonNullable<Variant['temperature']>;
type RecentNotification = {
  id: string;
  title: string;
  description: string;
  time: string;
  timestamp: number;
};

const POS: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'EWALLET'>('CASH');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [notifications, setNotifications] = useState<RecentNotification[]>(() => {
    const saved = localStorage.getItem('pos_notifications');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as RecentNotification[];
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return parsed.filter(n => n.timestamp > oneDayAgo);
    } catch { return []; }
  });

  const saveNotifications = (notifs: RecentNotification[]) => {
    setNotifications(notifs);
    localStorage.setItem('pos_notifications', JSON.stringify(notifs));
  };

  const barcodeRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll().then(r => r.data),
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: () => membersApi.getAll().then(r => r.data),
  });

  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    cats.set('all', 'Semua');
    products.forEach(p => {
      if (p.category) cats.set(p.category.id, p.category.name);
    });
    return Array.from(cats.entries());
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, search, selectedCategory]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch) return members.slice(0, 10);
    return members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase())).slice(0, 10);
  }, [members, memberSearch]);

  const formatCurrency = (n: number) => `Rp ${Number(n).toLocaleString('id-ID')}`;
  const userInitial = user?.username?.slice(0, 1).toUpperCase() || 'U';
  const formatNotificationTime = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const getVariantLabel = (variant: Variant) => {
    const details = [
      variant.size ? variant.size : null,
      variant.temperature ? TEMP_LABELS[variant.temperature] : null,
    ].filter(Boolean);

    return details.length > 0 ? details.join(' / ') : variant.sku;
  };

  const getPriceRange = (product: Product) => {
    const prices = product.variants.map(v => Number(v.price));
    if (prices.length === 0) return '-';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
  };

  const getAvailableVariants = (product: Product) => product.variants.filter(variant => variant.currentStock > 0);

  const getVariantOptions = (product: Product, field: 'size' | 'temperature') => {
    const values = product.variants
      .map(variant => variant[field])
      .filter((value): value is VariantOption => value !== null);
    const order = field === 'size' ? SIZE_ORDER : TEMP_ORDER;
    return Array.from(new Set(values)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  };

  const findMatchingVariant = (
    product: Product,
    currentVariant: Variant | undefined,
    next: { size?: string | null; temperature?: string | null },
  ) => {
    const targetSize = next.size !== undefined ? next.size : currentVariant?.size ?? null;
    const targetTemperature = next.temperature !== undefined ? next.temperature : currentVariant?.temperature ?? null;

    const exactMatch = product.variants.find(variant => {
      const sizeMatches = targetSize ? variant.size === targetSize : true;
      const tempMatches = targetTemperature ? variant.temperature === targetTemperature : true;
      return sizeMatches && tempMatches && variant.currentStock > 0;
    });

    if (exactMatch) return exactMatch;

    if (next.size !== undefined) {
      return product.variants.find(variant => variant.size === next.size && variant.currentStock > 0);
    }

    if (next.temperature !== undefined) {
      return product.variants.find(variant => variant.temperature === next.temperature && variant.currentStock > 0);
    }
  };

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0;
    cart.forEach(item => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      discount += item.discountAmount * item.quantity;
    });
    return { subtotal, discount, total: subtotal - discount };
  }, [cart]);

  const addToCart = (product: Product, variant?: Variant) => {
    const availableVariants = getAvailableVariants(product);
    const selectedVariant = variant ?? availableVariants.find(v => !cart.some(item => item.variantId === v.id)) ?? availableVariants[0];
    if (!selectedVariant || selectedVariant.currentStock <= 0) return;

    setCart(prev => {
      const existing = prev.find(i => i.variantId === selectedVariant.id);
      if (existing) {
        if (existing.quantity >= selectedVariant.currentStock) return prev;
        return prev.map(i => i.variantId === selectedVariant.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      const discountRate = memberId ? Number(selectedVariant.memberDiscountRate ?? product.category?.memberDiscountRate ?? 0) : 0;
      const price = Number(selectedVariant.price);
      return [...prev, {
        variantId: selectedVariant.id,
        productId: product.id,
        name: product.name,
        variantName: getVariantLabel(selectedVariant),
        price,
        quantity: 1,
        discountRate,
        discountAmount: (price * discountRate) / 100,
      }];
    });
  };

  const removeFromCart = (variantId: string) => setCart(prev => prev.filter(i => i.variantId !== variantId));

  const updateCartVariant = (oldVariantId: string, newVariantId: string) => {
    if (oldVariantId === newVariantId) return;

    const product = products.find(p => p.variants.some(v => v.id === newVariantId));
    const newVariant = product?.variants.find(v => v.id === newVariantId);
    if (!product || !newVariant || newVariant.currentStock <= 0) return;

    setCart(prev => {
      const currentItem = prev.find(item => item.variantId === oldVariantId);
      if (!currentItem) return prev;

      const existingTarget = prev.find(item => item.variantId === newVariantId);
      const discountRate = memberId ? Number(newVariant.memberDiscountRate ?? product.category?.memberDiscountRate ?? 0) : 0;
      const price = Number(newVariant.price);
      const nextQuantity = Math.min(currentItem.quantity, newVariant.currentStock);

      if (existingTarget) {
        const mergedQuantity = Math.min(existingTarget.quantity + nextQuantity, newVariant.currentStock);
        return prev
          .filter(item => item.variantId !== oldVariantId)
          .map(item => item.variantId === newVariantId
            ? {
              ...item,
              quantity: mergedQuantity,
              price,
              variantName: getVariantLabel(newVariant),
              discountRate,
              discountAmount: (price * discountRate) / 100,
            }
            : item);
      }

      return prev.map(item => item.variantId === oldVariantId
        ? {
          ...item,
          variantId: newVariant.id,
          productId: product.id,
          variantName: getVariantLabel(newVariant),
          price,
          quantity: nextQuantity,
          discountRate,
          discountAmount: (price * discountRate) / 100,
        }
        : item);
    });
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.variantId !== variantId) return i;
      const product = products.find(p => p.id === i.productId);
      const variant = product?.variants.find(v => v.id === variantId);
      const maxStock = variant?.currentStock ?? i.quantity;
      const newQty = Math.min(maxStock, Math.max(1, i.quantity + delta));
      return { ...i, quantity: newQty };
    }));
  };

  const selectMember = (m: Member) => {
    setMemberId(m.id);
    setMemberSearch(m.name);
    setShowMemberDropdown(false);
    // Recalculate discount on existing cart items
    setCart(prev => prev.map(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      const discountRate = Number(variant?.memberDiscountRate ?? product?.category?.memberDiscountRate ?? 0);
      return { ...item, discountRate, discountAmount: (item.price * discountRate) / 100 };
    }));
  };

  const clearMember = () => {
    setMemberId(null);
    setMemberSearch('');
    setCart(prev => prev.map(i => ({ ...i, discountRate: 0, discountAmount: 0 })));
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    try {
      const res = await api.get(`/products/variants/barcode/${barcodeInput.trim()}`);
      const variant = res.data;
      const product = products.find(p => p.id === variant.productId) ||
        await productsApi.getById(variant.productId).then(r => r.data);
      if (product) addToCart(product, { ...variant, currentStock: variant.currentStock ?? 1 });
      setBarcodeInput('');
    } catch {
      toast.error('Barcode tidak ditemukan');
      setBarcodeInput('');
    }
    barcodeRef.current?.focus();
  };

  const checkoutMutation = useMutation({
    mutationFn: () => ordersApi.create({
      memberId,
      paymentMethod,
      items: cart.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
    }),
    onSuccess: (res) => {
      const order = res.data as Order;
      setReceiptOrder(res.data);
      setCart([]);
      setMemberId(null);
      setMemberSearch('');
      setShowCheckoutConfirm(false);
      toast.success('Checkout berhasil', {
        description: `${order.orderNumber} berhasil dibuat dengan total ${formatCurrency(order.totalAmount)}.`,
      });
      const newNotif: RecentNotification = {
        id: order.id,
        title: 'Checkout berhasil',
        description: `${order.orderNumber} · ${formatCurrency(order.totalAmount)}`,
        time: formatNotificationTime(),
        timestamp: Date.now(),
      };
      saveNotifications([newNotif, ...notifications].slice(0, 50));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, 'Checkout gagal')),
  });

  const getImageUrl = (path: string) => {
    if (!path) return 'https://placehold.co/400x400?text=No+Image';
    if (path.startsWith('http')) return path;
    return `${SERVER_URL}${path}`;
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-background font-mono text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">
      Initialising Terminal Systems...
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-background font-sans antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Editorial Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-8">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <div className="text-xl font-bold uppercase tracking-[0.2em]">CAFE POS</div>
            <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              <span>Terminal: 001</span>
              <span className="h-2 w-px bg-border" />
              <span className="text-green-600">Active</span>
            </div>
          </div>
          
          <div className="h-10 w-px bg-border" />
          
          <nav className="flex items-center gap-6">
            <div className="relative group">
              <Search className="absolute left-0 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="SEARCH_PRODUCT"
                className="h-10 w-64 border-0 border-b border-transparent bg-transparent pl-6 text-xs font-bold uppercase tracking-widest placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:border-foreground transition-all rounded-none"
              />
            </div>
            
            <form onSubmit={handleBarcodeSubmit} className="relative group">
              <Barcode className="absolute left-0 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
              <Input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                placeholder="SCAN_BARCODE"
                className="h-10 w-48 border-0 border-b border-transparent bg-transparent pl-6 text-xs font-bold uppercase tracking-widest placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:border-foreground transition-all rounded-none"
              />
            </form>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-none border border-border bg-background hover:border-foreground transition-all">
                  <Bell className="size-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center bg-foreground text-[8px] font-bold text-background uppercase">
                      {notifications.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-none border-border">
                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Log_Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-[300px]">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      No_Active_Logs
                    </div>
                  ) : notifications.map(item => (
                    <DropdownMenuItem key={item.id} className="flex flex-col items-start gap-1 px-4 py-3 rounded-none border-b border-border/50 last:border-0">
                      <div className="flex w-full items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest">{item.title}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">{item.time}</span>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">{item.description}</span>
                    </DropdownMenuItem>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-none border-border bg-background px-4 text-[10px] font-bold uppercase tracking-widest hover:border-foreground transition-all"
              onClick={() => window.location.href = '/dashboard'}
            >
              <LayoutDashboard className="mr-2 size-3.5" />
              Systems
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 gap-3 rounded-none px-2 hover:bg-muted/50 transition-colors">
                <Avatar size="sm" className="rounded-none border border-border">
                  <AvatarFallback className="rounded-none bg-foreground text-background text-[10px] font-bold">{userInitial}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left xl:block">
                  <div className="text-[10px] font-bold uppercase tracking-widest">{user?.username || 'GUEST'}</div>
                  <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest leading-none">{user?.role || 'UNAUTHORIZED'}</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-none border-border">
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">User_Context</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                variant="destructive" 
                onClick={() => setIsLogoutDialogOpen(true)} 
                className="rounded-none focus:bg-destructive focus:text-destructive-foreground text-[10px] font-bold uppercase tracking-widest"
              >
                <LogOut className="mr-2 size-3.5" />
                Terminate_Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_450px]">
        {/* LEFT — Product Archive */}
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-muted/20">
          {/* Section Strips */}
          <div className="flex h-12 shrink-0 items-center border-b border-border bg-card px-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Box className="size-3" />
              <span>Archive_Browser</span>
            </div>
            <div className="mx-6 h-4 w-px bg-border" />
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1">
              <TabsList className="h-12 bg-transparent p-0" variant="line">
                {categories.map(([id, name]) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className="h-12 rounded-none border-b-2 border-transparent px-6 text-[10px] font-bold uppercase tracking-widest transition-all data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent"
                  >
                    {name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Grid Content */}
          <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-px overflow-y-auto bg-border border-b border-border">
            {filteredProducts.length === 0 && (
              <div className="col-span-full flex h-full flex-col items-center justify-center bg-card p-12 text-center">
                <Hash className="mb-4 size-12 text-muted/30" />
                <h3 className="text-sm font-bold uppercase tracking-[0.2em]">0_Items_Found</h3>
                <p className="mt-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Query returned no matching product manifests.</p>
              </div>
            )}
            {filteredProducts.map(product => (
              <div
                key={product.id}
                className={cn(
                  'group flex flex-col bg-card transition-colors hover:bg-muted/30',
                  getAvailableVariants(product).length === 0 && 'opacity-60',
                )}
              >
                <div className="relative overflow-hidden border-b border-border">
                  <AspectRatio ratio={1 / 1}>
                    <img
                      src={getImageUrl(product.image)}
                      alt={product.name}
                      className="size-full object-cover transition-all duration-500 group-hover:scale-105"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/500x500?text=VOID_ASSET'; }}
                    />
                  </AspectRatio>
                  <div className="absolute right-0 top-0 p-3">
                    {getAvailableVariants(product).length === 0 ? (
                      <Badge variant="destructive" className="rounded-none border-0 text-[8px] font-bold uppercase tracking-widest">DEPLETED</Badge>
                    ) : (
                      <div className="flex size-7 items-center justify-center border border-white/20 bg-black/60 font-mono text-[9px] font-bold text-white backdrop-blur-sm">
                        {getAvailableVariants(product).length}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-1 text-[8px] font-mono text-muted-foreground uppercase tracking-widest">
                    MANIFEST_{product.id.slice(-6).toUpperCase()}
                  </div>
                  <h3 className="mb-3 line-clamp-2 text-xs font-bold uppercase tracking-tight leading-tight">
                    {product.name}
                  </h3>
                  
                  <div className="mt-auto flex flex-col gap-3">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Price_Point</span>
                      <span className="text-sm font-bold tracking-tight">{getPriceRange(product)}</span>
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-none border-foreground px-3 text-[9px] font-bold uppercase tracking-widest transition-all hover:bg-foreground hover:text-background"
                      disabled={getAvailableVariants(product).length === 0}
                      onClick={() => addToCart(product)}
                    >
                      Process_Item
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — System Cart */}
        <div className="flex min-h-0 flex-col overflow-hidden border-l border-border bg-card shadow-[10px_0_40px_-15px_rgba(0,0,0,0.1)]">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-8">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center border border-border bg-muted/30">
                <ShoppingCart className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Transaction_Buffer</span>
                <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">Queue: {cart.length} manifest(s)</span>
              </div>
            </div>
            {cart.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCart([])}
                className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive"
              >
                Clear_Buffer
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="divide-y divide-border/50">
              {cart.length === 0 ? (
                <div className="flex h-[400px] flex-col items-center justify-center px-12 text-center opacity-40">
                  <Hash className="mb-4 size-10" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Transaction_Idle</span>
                  <span className="mt-2 text-[9px] font-medium uppercase tracking-widest leading-relaxed max-w-[200px]">Waiting for item entry into the manifest buffer.</span>
                </div>
              ) : cart.map(item => {
                const product = products.find(p => p.id === item.productId);
                const selectedVariant = product?.variants.find(v => v.id === item.variantId);

                return (
                  <div key={item.variantId} className="group px-8 py-6 transition-colors hover:bg-muted/10">
                    <div className="flex gap-6">
                      <div className="relative size-20 shrink-0 border border-border p-1 transition-all">
                        <img
                          src={product ? getImageUrl(product.image) : ''}
                          alt={item.name}
                          className="size-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x200?text=VOID'; }}
                        />
                      </div>
                      
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <h4 className="line-clamp-1 text-[11px] font-bold uppercase tracking-widest">{item.name}</h4>
                          <button 
                            onClick={() => removeFromCart(item.variantId)}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        
                        <div className="mb-4 text-[9px] font-mono text-muted-foreground uppercase">
                          REF_{item.variantId.slice(-6).toUpperCase()}
                        </div>
                        
                        <div className="mb-4 flex flex-wrap gap-2">
                          {product && getVariantOptions(product, 'size').length > 0 && (
                            <div className="flex gap-1 border border-border p-0.5">
                              {getVariantOptions(product, 'size').map(size => {
                                const target = findMatchingVariant(product, selectedVariant, { size });
                                const active = selectedVariant?.size === size;
                                return (
                                  <button
                                    key={size}
                                    disabled={!target}
                                    onClick={() => target && updateCartVariant(item.variantId, target.id)}
                                    className={cn(
                                      "h-6 min-w-8 px-2 text-[9px] font-bold uppercase transition-all",
                                      active ? "bg-foreground text-background" : "hover:bg-muted"
                                    )}
                                  >
                                    {size === 'SMALL' ? 'S' : size === 'MEDIUM' ? 'M' : 'L'}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          
                          {product && getVariantOptions(product, 'temperature').length > 0 && (
                            <div className="flex gap-1 border border-border p-0.5">
                              {getVariantOptions(product, 'temperature').map(temp => {
                                const target = findMatchingVariant(product, selectedVariant, { temperature: temp });
                                const active = selectedVariant?.temperature === temp;
                                return (
                                  <button
                                    key={temp}
                                    disabled={!target}
                                    onClick={() => target && updateCartVariant(item.variantId, target.id)}
                                    className={cn(
                                      "h-6 px-3 text-[9px] font-bold uppercase transition-all",
                                      active ? "bg-foreground text-background" : "hover:bg-muted"
                                    )}
                                  >
                                    {temp}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center border border-border">
                            <button 
                              onClick={() => updateQuantity(item.variantId, -1)}
                              className="flex size-7 items-center justify-center hover:bg-muted"
                            >
                              <Minus className="size-3" />
                            </button>
                            <span className="flex h-7 min-w-8 items-center justify-center border-x border-border font-mono text-[10px] font-bold">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.variantId, 1)}
                              className="flex size-7 items-center justify-center hover:bg-muted"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                          
                          <div className="flex flex-col items-end">
                            {item.discountRate > 0 && (
                              <span className="text-[9px] font-bold text-green-600 uppercase tracking-widest">-{item.discountRate}% ADJUST</span>
                            )}
                            <span className="text-sm font-bold tracking-tight">
                              {formatCurrency((item.price - item.discountAmount) * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Buffer Summary */}
          <div className="shrink-0 space-y-6 border-t border-border bg-muted/10 p-8">
            <div className="space-y-4">
              <div className="relative">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Entity_Affiliation</label>
                  {memberId && (
                    <button onClick={clearMember} className="text-[9px] font-bold uppercase tracking-widest text-destructive">Detach</button>
                  )}
                </div>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={memberSearch}
                    onChange={e => { setMemberSearch(e.target.value); setShowMemberDropdown(true); if (!e.target.value) clearMember(); }}
                    onFocus={() => setShowMemberDropdown(true)}
                    placeholder="QUERY_MEMBER"
                    className="h-10 rounded-none border-border bg-background pl-9 text-[10px] font-bold uppercase tracking-widest focus-visible:ring-0 focus-visible:border-foreground"
                  />
                </div>
                
                {showMemberDropdown && filteredMembers.length > 0 && !memberId && (
                  <div className="absolute bottom-full mb-1 left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-none border border-border bg-card shadow-2xl">
                    {filteredMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => selectMember(m)}
                        className="flex w-full flex-col border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest">{m.name}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">{m.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="border border-dashed border-border p-4">
                <div className="mb-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>Base_Subtotal</span>
                    <span className="text-foreground">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-green-600">
                      <span>Adjustment_Member</span>
                      <span>-{formatCurrency(totals.discount)}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-end justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Settlement_Amount</span>
                    <span className="text-3xl font-bold tracking-tighter text-primary">{formatCurrency(totals.total)}</span>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Protocol</span>
                    <div className="flex items-center gap-2 border border-border bg-background px-2 py-1">
                      {paymentMethod === 'CASH' ? <Banknote className="size-3.5" /> : paymentMethod === 'CARD' ? <CreditCard className="size-3.5" /> : <Wallet className="size-3.5" />}
                      <span className="text-[9px] font-bold uppercase tracking-widest">{paymentMethod}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['CASH', 'CARD', 'EWALLET'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 border border-border bg-background px-2 py-3 transition-all",
                    paymentMethod === m ? "border-foreground bg-foreground text-background" : "hover:border-foreground/50"
                  )}
                >
                  {m === 'CASH' ? <Banknote className="size-4" /> : m === 'CARD' ? <CreditCard className="size-4" /> : <Wallet className="size-4" />}
                  <span className="text-[9px] font-bold uppercase tracking-widest">{m === 'CASH' ? 'CASH' : m === 'CARD' ? 'CARD' : 'DIGITAL'}</span>
                </button>
              ))}
            </div>

            <Button
              disabled={cart.length === 0 || checkoutMutation.isPending}
              onClick={() => setShowCheckoutConfirm(true)}
              className="h-14 w-full rounded-none bg-foreground text-[11px] font-bold uppercase tracking-[0.3em] text-background hover:bg-muted-foreground transition-all disabled:opacity-30"
            >
              {checkoutMutation.isPending ? 'PROCESSING_ORDER...' : 'AUTHORIZE_SETTLEMENT'}
            </Button>
          </div>
        </div>
      </div>

      <ReceiptModal isOpen={!!receiptOrder} onClose={() => setReceiptOrder(null)} order={receiptOrder} />
      
      <Modal
        isOpen={showCheckoutConfirm}
        onClose={() => {
          if (!checkoutMutation.isPending) setShowCheckoutConfirm(false);
        }}
        title="TRANSACTION_SETTLEMENT"
        size="md"
      >
        <div className="space-y-8 font-sans">
          <div className="grid grid-cols-2 gap-px border border-border bg-border">
            <div className="bg-card p-6">
              <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Entity_Status</span>
              <span className="text-xs font-bold uppercase tracking-widest">{memberId ? memberSearch : 'ANONYMOUS_ENTITY'}</span>
            </div>
            <div className="bg-card p-6">
              <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Settlement_Protocol</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest">{paymentMethod}</span>
              </div>
            </div>
          </div>

          <div className="border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                  <TableHead className="h-12 px-6 text-[10px] font-bold uppercase tracking-widest">Entry_Description</TableHead>
                  <TableHead className="h-12 text-center text-[10px] font-bold uppercase tracking-widest">Qty</TableHead>
                  <TableHead className="h-12 px-6 text-right text-[10px] font-bold uppercase tracking-widest">Settlement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map(item => (
                  <TableRow key={item.variantId} className="border-b border-border hover:bg-transparent last:border-0">
                    <TableCell className="px-6 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">{item.name}</div>
                      <div className="mt-1 text-[9px] font-mono text-muted-foreground uppercase">
                        {item.variantName} · @{formatCurrency(item.price)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-[10px] font-bold">{item.quantity}</TableCell>
                    <TableCell className="px-6 text-right font-mono text-[10px] font-bold">
                      {formatCurrency((item.price - item.discountAmount) * item.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-4 border border-border bg-muted/20 p-8">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>Gross_Subtotal</span>
              <span className="text-foreground">{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-green-600">
                <span>Total_Adjustment</span>
                <span>-{formatCurrency(totals.discount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-border pt-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Net_Settlement</span>
              <span className="text-3xl font-bold tracking-tighter text-primary">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-none border-border text-[10px] font-bold uppercase tracking-widest transition-all hover:border-foreground"
              onClick={() => setShowCheckoutConfirm(false)}
              disabled={checkoutMutation.isPending}
            >
              Abort_Operation
            </Button>
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending || cart.length === 0}
              className="flex-[2] h-12 rounded-none bg-foreground text-[10px] font-bold uppercase tracking-[0.2em] text-background hover:bg-muted-foreground transition-all"
            >
              {checkoutMutation.isPending ? 'PROCESSING...' : 'EXECUTE_SETTLEMENT'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isLogoutDialogOpen}
        onConfirm={logout}
        onCancel={() => setIsLogoutDialogOpen(false)}
        title="SESSION_TERMINATION"
        message="REQUESTING PERMISSION TO TERMINATE CURRENT OPERATOR SESSION. DATA BUFFERS WILL BE PERSISTED."
        confirmLabel="AUTHORIZE_LOGOUT"
        confirmDanger
      />
    </div>
  );
};

export default POS;
