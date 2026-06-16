import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, LogOut, LayoutDashboard, Search, Barcode, X, Plus, Minus, Trash2, PackageSearch, Bell, Banknote, CreditCard, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import api, { productsApi, membersApi, ordersApi, SERVER_URL } from '../api/api';
import { useAuth } from '../hooks/useAuth';
import ReceiptModal from '../components/ReceiptModal';
import Modal from '../components/Modal';
import type { Product, Variant, CartItem, Member, Order } from '../types';
import { getErrorMessage } from '../utils/error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

const SIZE_LABELS: Record<string, string> = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
};

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
      variant.size ? SIZE_LABELS[variant.size] : null,
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
      alert('Barcode tidak ditemukan');
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
    onError: (err: unknown) => alert(getErrorMessage(err, 'Checkout gagal')),
  });

  const getImageUrl = (path: string) => {
    if (!path) return 'https://placehold.co/200x120?text=No+Image';
    if (path.startsWith('http')) return path;
    return `${SERVER_URL}${path}`;
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading produk...
    </div>
  );

  return (
    <div className="grid h-screen min-h-0 grid-cols-[1fr_380px] bg-background">
      {/* LEFT — Products */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        {/* Header */}
        <div className="grid h-16 shrink-0 grid-cols-[160px_minmax(320px,1fr)_auto] items-center gap-4 border-b bg-card px-4">
          <div className="min-w-0">
            <div className="text-base font-semibold leading-none text-foreground">Cafe POS</div>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(220px,1fr)_180px] gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari produk..."
                className="h-9 rounded-none pl-8"
              />
            </div>
            <form onSubmit={handleBarcodeSubmit}>
              <div className="relative">
                <Barcode className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={barcodeRef}
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode..."
                  className="h-9 rounded-none pl-8"
                />
              </div>
            </form>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="relative rounded-none" title="Notifikasi">
                  <Bell className="size-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-none bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {notifications.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="font-semibold text-foreground">Notifikasi Terbaru</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <DropdownMenuItem disabled className="py-4 text-muted-foreground">
                    Belum ada notifikasi
                  </DropdownMenuItem>
                ) : notifications.map(item => (
                  <DropdownMenuItem key={item.id} className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 size-2 shrink-0 bg-green-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground">{item.title}</span>
                      <span className="mt-0.5 block truncate text-muted-foreground">{item.description}</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">{item.time}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              onClick={() => window.location.href = '/dashboard'}
              title="Dashboard"
            >
              <LayoutDashboard className="size-4" />
              Dashboard
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="h-9 rounded-none px-2" title="Akun">
                  <Avatar size="sm" className="rounded-none after:rounded-none">
                    <AvatarFallback className="rounded-none">{userInitial}</AvatarFallback>
                  </Avatar>
                  <span className="hidden min-w-0 text-left xl:block">
                    <span className="block max-w-28 truncate text-xs font-semibold leading-tight">{user?.username || '-'}</span>
                    <span className="block text-[11px] font-normal leading-tight text-muted-foreground">{user?.role || 'User'}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block font-semibold text-foreground">{user?.username || '-'}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">{user?.role || 'User'}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={logout}>
                  <LogOut className="size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="shrink-0 border-b bg-card px-4 py-2">
          <TabsList className="max-w-full justify-start overflow-x-auto" variant="line">
            {categories.map(([id, name]) => (
              <TabsTrigger key={id} value={id} className="rounded-none px-3">
                {name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Product Grid */}
        <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4 overflow-y-auto p-4">
          {filteredProducts.length === 0 && (
            <Empty className="col-span-full min-h-72 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageSearch className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Tidak ada produk</EmptyTitle>
                <EmptyDescription>Produk tidak ditemukan untuk pencarian atau kategori ini.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {filteredProducts.map(product => (
            <Card
              key={product.id}
              className={cn(
                'rounded-none p-0 transition hover:border-primary/40 hover:shadow-md',
                getAvailableVariants(product).length === 0 && 'opacity-70',
              )}
            >
              <AspectRatio ratio={4 / 3} className="relative bg-muted">
                <img
                  src={getImageUrl(product.image)}
                  alt={product.name}
                  className="size-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/220x128?text=No+Image'; }}
                />
                {getAvailableVariants(product).length === 0 && (
                  <Badge variant="destructive" className="absolute left-2 top-2 rounded-none">Habis</Badge>
                )}
              </AspectRatio>
              <CardContent className="p-3">
                <div className="line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-tight text-foreground">{product.name}</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-green-600">{getPriceRange(product)}</span>
                  {product.category?.name && <Badge variant="outline" className="max-w-24 truncate rounded-none">{product.category.name}</Badge>}
                </div>
              </CardContent>
              <CardFooter className="border-t p-3">
                <Button
                  type="button"
                  className="w-full rounded-none"
                  disabled={getAvailableVariants(product).length === 0}
                  onClick={() => addToCart(product)}
                >
                  <Plus className="size-4" />
                  Tambahkan
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* RIGHT — Cart */}
      <div className="flex min-h-0 flex-col overflow-hidden border-l bg-card">
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <ShoppingCart className="size-5 text-primary" />
          <span className="font-bold text-foreground">Keranjang</span>
          {cart.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5">
              <Badge variant="outline" className="rounded-none border-primary/20 bg-primary/5 text-primary">
                {cart.length} item
              </Badge>
              <Badge className="rounded-none">
                {cart.reduce((s, i) => s + i.quantity, 0)} qty
              </Badge>
            </div>
          )}
        </div>

        {/* Cart Items */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2">
          {cart.length === 0 ? (
            <Empty className="min-h-80 border-0 p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingCart className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Keranjang kosong</EmptyTitle>
                <EmptyDescription>Pilih produk untuk mulai membuat pesanan.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : cart.map(item => {
            const product = products.find(p => p.id === item.productId);
            const selectedVariant = product?.variants.find(v => v.id === item.variantId);

            return (
              <div key={item.variantId} className="border-b px-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <img
                      src={product ? getImageUrl(product.image) : ''}
                      alt={item.name}
                      className="size-14 shrink-0 rounded-none border object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=?'; }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-extrabold leading-tight text-foreground">{item.name}</div>
                      {product && (
                        <div className="mt-2 grid gap-1.5">
                          {getVariantOptions(product, 'size').length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {getVariantOptions(product, 'size').map(size => {
                                const target = findMatchingVariant(product, selectedVariant, { size });
                                const active = selectedVariant?.size === size;
                                return (
                                  <Button
                                    key={size}
                                    type="button"
                                    size="sm"
                                    variant={active ? 'default' : 'outline'}
                                    disabled={!target}
                                    onClick={() => target && updateCartVariant(item.variantId, target.id)}
                                    className="h-9 min-w-10 rounded-none px-2 text-sm"
                                  >
                                    {size === 'SMALL' ? 'S' : size === 'MEDIUM' ? 'M' : 'L'}
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                          {getVariantOptions(product, 'temperature').length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {getVariantOptions(product, 'temperature').map(temperature => {
                                const target = findMatchingVariant(product, selectedVariant, { temperature });
                                const active = selectedVariant?.temperature === temperature;
                                return (
                                  <Button
                                    key={temperature}
                                    type="button"
                                    size="sm"
                                    variant={active ? 'default' : 'outline'}
                                    disabled={!target}
                                    onClick={() => target && updateCartVariant(item.variantId, target.id)}
                                    className="h-9 rounded-none px-3 text-sm"
                                  >
                                    {TEMP_LABELS[temperature]}
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-1.5 text-xs text-muted-foreground">
                        SKU {selectedVariant?.sku || item.variantName} · {formatCurrency(item.price)} / pcs
                        {item.discountRate > 0 && (
                          <span className="ml-1 text-green-600">(-{item.discountRate}%)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeFromCart(item.variantId)} className="size-8 rounded-none text-destructive">
                    <Trash2 className="size-5" />
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-muted p-1">
                    <Button type="button" variant="outline" size="icon" onClick={() => updateQuantity(item.variantId, -1)} className="size-6 rounded-none">
                      <Minus className="size-3" />
                    </Button>
                    <span className="min-w-5 text-center text-sm font-bold">{item.quantity}</span>
                    <Button type="button" variant="outline" size="icon" onClick={() => updateQuantity(item.variantId, 1)} className="size-6 rounded-none">
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <span className="text-sm font-extrabold text-foreground">
                    {formatCurrency((item.price - item.discountAmount) * item.quantity)}
                  </span>
                </div>
              </div>
            );
          })}
          </div>
        </ScrollArea>

        {/* Cart Footer */}
        <div className="shrink-0 border-t p-3">
          {/* Member Select */}
          <div className="relative mb-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Member (Opsional)</label>
            <div className="flex gap-2">
              <Input
                value={memberSearch}
                onChange={e => { setMemberSearch(e.target.value); setShowMemberDropdown(true); if (!e.target.value) clearMember(); }}
                onFocus={() => setShowMemberDropdown(true)}
                placeholder="Cari nama member..."
                className="h-8 rounded-none text-xs"
              />
              {memberId && (
                <Button type="button" variant="destructive" size="icon" onClick={clearMember} className="h-8 w-8 rounded-none">
                  <X className="size-4" />
                </Button>
              )}
            </div>
            {showMemberDropdown && filteredMembers.length > 0 && !memberId && (
              <div className="absolute bottom-full left-0 right-0 z-50 max-h-40 overflow-y-auto border bg-popover shadow-lg">
                {filteredMembers.map(m => (
                  <div
                    key={m.id}
                    onClick={() => selectMember(m)}
                    className="cursor-pointer border-b px-3 py-2 text-xs hover:bg-muted"
                  >
                    {m.name} {m.phone ? `· ${m.phone}` : ''}
                  </div>
                ))}
              </div>
            )}
            {memberId && <div className="mt-1 text-xs text-green-600">Diskon member aktif</div>}
          </div>

          {/* Totals */}
          <div className="mb-2 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Diskon</span>
                <span>-{formatCurrency(totals.discount)}</span>
              </div>
            )}
          </div>
          <div className="mb-3 flex justify-between text-lg font-extrabold text-foreground">
            <span>Total</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>

          {/* Payment Method */}
          <ToggleGroup
            type="single"
            value={paymentMethod}
            onValueChange={value => { if (value) setPaymentMethod(value as typeof paymentMethod); }}
            variant="outline"
            size="sm"
            spacing={1}
            className="mb-3 grid w-full grid-cols-3"
          >
            {(['CASH', 'CARD', 'EWALLET'] as const).map(m => (
              <ToggleGroupItem
                key={m}
                value={m}
                className="flex h-12 w-full flex-col gap-0.5 rounded-none px-1 text-[10px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {m === 'CASH' ? <Banknote className="size-4" /> : m === 'CARD' ? <CreditCard className="size-4" /> : <Wallet className="size-4" />}
                {m === 'CASH' ? 'Cash' : m === 'CARD' ? 'Card' : 'E-Wallet'}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Button
            type="button"
            disabled={cart.length === 0 || checkoutMutation.isPending}
            onClick={() => setShowCheckoutConfirm(true)}
            className="h-11 w-full rounded-none bg-green-600 text-base hover:bg-green-700"
          >
            {checkoutMutation.isPending ? 'Memproses...' : 'CHECKOUT'}
          </Button>
        </div>
      </div>

      <ReceiptModal isOpen={!!receiptOrder} onClose={() => setReceiptOrder(null)} order={receiptOrder} />
      <Modal
        isOpen={showCheckoutConfirm}
        onClose={() => {
          if (!checkoutMutation.isPending) setShowCheckoutConfirm(false);
        }}
        title="Konfirmasi Checkout"
        size="md"
      >
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="border bg-muted/50 p-3">
              <div className="text-xs font-bold uppercase text-muted-foreground">Member</div>
              <div className="mt-1 text-sm font-bold text-foreground">{memberId ? memberSearch : 'Non-member'}</div>
            </div>
            <div className="border bg-muted/50 p-3">
              <div className="text-xs font-bold uppercase text-muted-foreground">Pembayaran</div>
              <div className="mt-1 text-sm font-bold text-foreground">{paymentMethod}</div>
            </div>
          </div>

          <div className="mb-4 border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map(item => (
                  <TableRow key={item.variantId}>
                    <TableCell>
                      <div className="font-bold text-foreground">{item.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {item.variantName} · {formatCurrency(item.price)}
                        {item.discountRate > 0 && <span className="text-green-600"> · Diskon {item.discountRate}%</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                    <TableCell className="text-right font-extrabold text-foreground">
                      {formatCurrency((item.price - item.discountAmount) * item.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mb-4 grid gap-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Diskon</span>
                <span>-{formatCurrency(totals.discount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t pt-3 text-lg font-extrabold text-foreground">
              <span>Total Bayar</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setShowCheckoutConfirm(false)}
              disabled={checkoutMutation.isPending}
            >
              Cek Lagi
            </Button>
            <Button
              type="button"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending || cart.length === 0}
              className="rounded-none bg-green-600 hover:bg-green-700"
            >
              {checkoutMutation.isPending ? 'Memproses...' : 'Konfirmasi Bayar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default POS;
