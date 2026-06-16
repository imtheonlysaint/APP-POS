import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, stockApi } from '../../api/api';
import type { Product } from '../../types';
import { getErrorMessage } from '../../utils/error';
import FormRow from './FormRow';
import Modal from '../Modal';
import AdminDataTable, { type DataTableColumn } from '../AdminDataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface VariantStockRow {
  variantId: string;
  sku: string;
  productName: string;
  currentStock: number;
  price: number;
}

const StockTab: React.FC = () => {
  const qc = useQueryClient();
  const [adjustTarget, setAdjustTarget] = useState<{ variantId: string; sku: string; productName: string } | null>(null);
  const [adjustForm, setAdjustForm] = useState({ quantityChange: '', reason: 'RESTOCK' });

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll().then(r => r.data),
  });

  const allVariants: VariantStockRow[] = products.flatMap(p =>
    p.variants.map(v => ({ variantId: v.id, sku: v.sku, productName: p.name, currentStock: v.currentStock, price: v.price }))
  );

  const adjustMutation = useMutation({
    mutationFn: () => stockApi.adjust({
      variantId: adjustTarget!.variantId,
      quantityChange: Number(adjustForm.quantityChange),
      reason: adjustForm.reason,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setAdjustTarget(null);
      setAdjustForm({ quantityChange: '', reason: 'RESTOCK' });
    },
    onError: (e: unknown) => alert(getErrorMessage(e, 'Gagal adjust stok')),
  });

  const columns: DataTableColumn<VariantStockRow>[] = [
    {
      key: 'product',
      header: 'Produk',
      render: v => v.productName,
      searchValue: v => v.productName,
      sortValue: v => v.productName,
    },
    {
      key: 'sku',
      header: 'SKU',
      render: v => <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{v.sku}</code>,
      searchValue: v => v.sku,
      sortValue: v => v.sku,
    },
    {
      key: 'stock',
      header: 'Stok Saat Ini',
      render: v => (
        <div className="flex items-center gap-2">
          <span className="font-bold">{v.currentStock}</span>
          {v.currentStock <= 5 && v.currentStock > 0 && <Badge variant="secondary">Hampir habis</Badge>}
          {v.currentStock <= 0 && <Badge variant="destructive">Habis</Badge>}
        </div>
      ),
      sortValue: v => v.currentStock,
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: v => (
        <Button size="sm" variant="outline" onClick={() => setAdjustTarget({ variantId: v.variantId, sku: v.sku, productName: v.productName })}>
          Adjust Stok
        </Button>
      ),
      align: 'right',
      width: '150px',
    },
  ];

  return (
    <div>
      <AdminDataTable
        title="Manajemen Stok"
        data={allVariants}
        columns={columns}
        getRowKey={v => v.variantId}
        isLoading={isLoading}
        searchPlaceholder="Cari produk / SKU..."
      />
      <Modal isOpen={!!adjustTarget} onClose={() => setAdjustTarget(null)} title="Adjust Stok" size="sm">
        {adjustTarget && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              <strong className="text-foreground">{adjustTarget.productName}</strong> — {adjustTarget.sku}
            </p>
            
            <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-3 text-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stok Saat Ini</p>
                <p className="text-lg font-bold">{allVariants.find(v => v.variantId === adjustTarget.variantId)?.currentStock || 0}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stok Akhir</p>
                <p className={cn(
                  "text-lg font-bold",
                  (allVariants.find(v => v.variantId === adjustTarget.variantId)?.currentStock || 0) + Number(adjustForm.quantityChange || 0) < 0 
                    ? "text-destructive" 
                    : "text-primary"
                )}>
                  {(allVariants.find(v => v.variantId === adjustTarget.variantId)?.currentStock || 0) + Number(adjustForm.quantityChange || 0)}
                </p>
              </div>
            </div>

            <FormRow label="Perubahan Jumlah (+ tambah / - kurangi)">
              <Input 
                type="number" 
                value={adjustForm.quantityChange} 
                onChange={e => setAdjustForm(f => ({ ...f, quantityChange: e.target.value }))} 
                placeholder="Contoh: 10 atau -5"
                className="h-10 text-sm"
              />
              <p className={cn(
                "mt-1.5 text-[10px]",
                (allVariants.find(v => v.variantId === adjustTarget.variantId)?.currentStock || 0) + Number(adjustForm.quantityChange || 0) < 0 
                  ? "font-bold text-destructive" 
                  : "text-muted-foreground"
              )}>
                {(allVariants.find(v => v.variantId === adjustTarget.variantId)?.currentStock || 0) + Number(adjustForm.quantityChange || 0) < 0 
                  ? "Peringatan: Stok tidak boleh kurang dari 0." 
                  : "Stok akhir tidak boleh kurang dari 0."}
              </p>
            </FormRow>
            <FormRow label="Alasan">
              <Select value={adjustForm.reason} onValueChange={value => setAdjustForm(f => ({ ...f, reason: value }))}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESTOCK">RESTOCK (Penambahan stok)</SelectItem>
                  <SelectItem value="SPOILAGE">SPOILAGE (Barang rusak/basi)</SelectItem>
                  <SelectItem value="RETURN">RETURN (Pengembalian)</SelectItem>
                  <SelectItem value="ADJUSTMENT">ADJUSTMENT (Koreksi manual)</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>
            <div className="mt-6 flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setAdjustTarget(null)} className="h-10 px-4">Batal</Button>
              <Button 
                type="button" 
                onClick={() => adjustMutation.mutate()} 
                disabled={
                  !adjustForm.quantityChange || 
                  adjustMutation.isPending || 
                  ((allVariants.find(v => v.variantId === adjustTarget.variantId)?.currentStock || 0) + Number(adjustForm.quantityChange || 0) < 0)
                }
                className="h-10 px-6 font-bold"
              >
                {adjustMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default StockTab;
