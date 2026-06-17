import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsUpDown, Search, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  searchValue?: (row: T) => string;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface AdminDataTableProps<T> {
  title: string;
  data: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  actions?: React.ReactNode;
  emptyText?: string;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  renderExpandedRow?: (row: T) => React.ReactNode;
  isRowExpanded?: (row: T) => boolean;
}

const pageSizes = [10, 25, 50];

const normalizeSortValue = (value: string | number | Date | null | undefined) => {
  if (value instanceof Date) return value.getTime();
  if (value == null) return '';
  return value;
};

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function AdminDataTable<T>({
  title,
  data,
  columns,
  getRowKey,
  isLoading = false,
  actions,
  emptyText = 'BUFFER_EMPTY',
  searchPlaceholder = 'QUERY_RESOURCES...',
  onRowClick,
  renderExpandedRow,
  isRowExpanded,
}: AdminDataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const searchableColumns = columns.filter(column => column.searchValue);

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;

    return data.filter(row => {
      const values = searchableColumns.length > 0 ? searchableColumns : columns;
      return values.some(column => {
        const value = column.searchValue?.(row) ?? String(column.render(row) ?? '');
        return value.toLowerCase().includes(query);
      });
    });
  }, [columns, data, search, searchableColumns]);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const column = columns.find(item => item.key === sort.key);
    if (!column?.sortValue) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = normalizeSortValue(column.sortValue?.(a));
      const bValue = normalizeSortValue(column.sortValue?.(b));

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return sort.direction === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [columns, filteredData, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleData = sortedData.slice(startIndex, startIndex + pageSize);

  const changeSort = (key: string) => {
    const column = columns.find(item => item.key === key);
    if (!column?.sortValue) return;
    setPage(1);
    setSort(current => {
      if (current?.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex flex-col gap-6 border-b border-border p-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <Database className="size-3" />
            <span>RESOURCE_DATA_TABLE</span>
          </div>
          <h2 className="text-xl font-bold uppercase tracking-tighter">{title.replace(' ', '_')}</h2>
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            {filteredData.length.toString().padStart(3, '0')} / {data.length.toString().padStart(3, '0')} ENTRIES_INDEXED
          </div>
        </div>
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="relative group">
            <Search className="absolute left-0 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={searchPlaceholder.toUpperCase()}
              className="h-10 w-full sm:w-64 border-0 border-b border-border bg-transparent pl-6 text-[10px] font-bold uppercase tracking-widest placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:border-foreground rounded-none transition-all"
            />
          </div>
          <div className="flex bg-border border border-border">
            {actions}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
              {columns.map(column => (
                <TableHead
                  key={column.key}
                  className={cn(
                    'h-12 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap',
                    alignClass[column.align || 'left'],
                  )}
                  style={{ width: column.width }}
                >
                  <button
                    type="button"
                    onClick={() => changeSort(column.key)}
                    disabled={!column.sortValue}
                    className={cn(
                      'inline-flex items-center gap-1.5 bg-transparent p-0 text-inherit transition-colors',
                      column.sortValue ? 'cursor-pointer hover:text-foreground' : 'cursor-default',
                    )}
                  >
                    {column.header.toUpperCase().replace(' ', '_')}
                    {column.sortValue && <ChevronsUpDown className="size-3 opacity-50" />}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-20 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
                  SCANNING_SYSTEM_RESOURCES...
                </TableCell>
              </TableRow>
            ) : visibleData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-20 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {emptyText.toUpperCase().replace(' ', '_')}
                </TableCell>
              </TableRow>
            ) : visibleData.map((row, idx) => (
              <React.Fragment key={getRowKey(row)}>
                <TableRow
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-border last:border-0 hover:bg-muted/20 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map(column => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        'px-6 py-4 text-[11px] font-bold uppercase tracking-tight',
                        alignClass[column.align || 'left']
                      )}
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
                {isRowExpanded?.(row) && renderExpandedRow && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length} className="bg-muted/10 p-8 border-b border-border">
                      <div className="border border-border bg-card p-6">
                        {renderExpandedRow(row)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-6 border-t border-border bg-muted/10 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>PER_PAGE:</span>
            <Select value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); }}>
              <SelectTrigger className="h-8 w-20 rounded-none border-border bg-background text-[10px] font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-border">
                {pageSizes.map(size => <SelectItem key={size} value={String(size)} className="text-[10px] font-bold">{size}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <span className="font-mono">
            BLOCK: {sortedData.length === 0 ? '000' : (startIndex + 1).toString().padStart(3, '0')}-{Math.min(startIndex + pageSize, sortedData.length).toString().padStart(3, '0')} / {sortedData.length.toString().padStart(3, '0')}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-border border border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="h-9 w-12 rounded-none bg-card hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center bg-card px-6 text-[10px] font-bold uppercase tracking-widest border-x border-border">
              Page_{safePage.toString().padStart(2, '0')} / {totalPages.toString().padStart(2, '0')}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
              className="h-9 w-12 rounded-none bg-card hover:bg-muted"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDataTable;
