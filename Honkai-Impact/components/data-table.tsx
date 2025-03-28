"use client";

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheckFilled,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconClock,
  IconSearch,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { z } from "zod";

import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Updated schema to match report data structure
export const schema = z.object({
  id: z.number(),
  trackingId: z.string(),
  title: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  content: z.string(),
  evidenceCount: z.number().optional(),
  category: z.object({
    id: z.string(),
    description: z.string().nullable(),
    name: z.string(),
    icon: z.string().nullable(),
  }),
});

// Create a separate component for the drag handle
const DragHandle = React.memo(({ id }: { id: number }) => {
  const { attributes, listeners } = useSortable({
    id,
  });

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
});
DragHandle.displayName = "DragHandle";

// Updated columns for reports data - memoized to prevent unnecessary renders
const createColumns = (): ColumnDef<z.infer<typeof schema>>[] => [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "trackingId",
    header: "Tracking ID",
    cell: ({ row }) => {
      return (
        <Link
          href={`/report/${row.original.trackingId}`}
          className="text-primary font-medium hover:underline"
        >
          {row.original.trackingId}
        </Link>
      );
    },
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      return (
        <Link
          href={`/report/${row.original.trackingId}`}
          className="text-foreground hover:underline"
        >
          {row.original.title}
        </Link>
      );
    },
    enableHiding: false,
  },
  {
    accessorKey: "category.name",
    header: "Category",
    cell: ({ row }) => {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {row.original.category?.icon && (
            <span className="mr-1">{row.original.category.icon}</span>
          )}
          {row.original.category?.name || "Uncategorized"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const statusMap: Record<
        string,
        { icon: React.ReactNode; color: string }
      > = {
        SUBMITTED: {
          icon: <IconClock className="size-3.5" />,
          color:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500",
        },
        UNDER_REVIEW: {
          icon: <IconClock className="size-3.5" />,
          color:
            "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-500",
        },
        IN_PROGRESS: {
          icon: <IconLoader className="size-3.5 animate-spin" />,
          color:
            "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500",
        },
        RESOLVED: {
          icon: <IconCircleCheckFilled className="size-3.5" />,
          color:
            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500",
        },
      };

      const status = row.original.status;
      const { icon, color } = statusMap[status] || {
        icon: <IconSearch className="size-3.5" />,
        color:
          "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-500",
      };

      return (
        <Badge variant="secondary" className={`gap-1 ${color}`}>
          {icon}
          {status === "SUBMITTED"
            ? "Pending Review"
            : status === "UNDER_REVIEW"
            ? "Under Review"
            : status === "IN_PROGRESS"
            ? "In Progress"
            : status === "RESOLVED"
            ? "Resolved"
            : status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Submitted",
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      return (
        <span className="text-muted-foreground">
          {date.toLocaleDateString()}
        </span>
      );
    },
  },
  {
    accessorKey: "evidenceCount",
    header: "Evidence",
    cell: ({ row }) => {
      const count = row.original.evidenceCount || 0;
      return (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {count} {count === 1 ? "file" : "files"}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
            size="icon"
          >
            <IconDotsVertical />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/report/${row.original.trackingId}`}>
              View Report Details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/report/${row.original.trackingId}/update`}>
              Update Status
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            Archive Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

// Memoized draggable row for better performance
const DraggableRow = React.memo(
  ({ row }: { row: Row<z.infer<typeof schema>> }) => {
    const { transform, transition, setNodeRef, isDragging } = useSortable({
      id: row.original.id,
    });

    return (
      <TableRow
        data-state={row.getIsSelected() && "selected"}
        data-dragging={isDragging}
        ref={setNodeRef}
        className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
        style={{
          transform: CSS.Transform.toString(transform),
          transition: transition,
        }}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    );
  }
);
DraggableRow.displayName = "DraggableRow";

// Optimized pagination controls
const PaginationControls = React.memo(
  ({
    table,
  }: {
    table: ReturnType<typeof useReactTable<z.infer<typeof schema>>>;
  }) => {
    return (
      <div className="flex w-fit items-center gap-2 lg:ml-0">
        <Button
          variant="outline"
          className="hidden h-8 w-8 p-0 lg:flex"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Go to first page</span>
          <IconChevronsLeft />
        </Button>
        <Button
          variant="outline"
          className="size-8"
          size="icon"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Go to previous page</span>
          <IconChevronLeft />
        </Button>
        <Button
          variant="outline"
          className="size-8"
          size="icon"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Go to next page</span>
          <IconChevronRight />
        </Button>
        <Button
          variant="outline"
          className="hidden size-8 lg:flex"
          size="icon"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Go to last page</span>
          <IconChevronsRight />
        </Button>
      </div>
    );
  }
);
PaginationControls.displayName = "PaginationControls";

export function DataTable({
  data: initialData,
}: {
  data: z.infer<typeof schema>[];
}) {
  const [data, setData] = useState(initialData);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const sortableId = React.useId();

  // Optimize sensors with useCallback
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  // Memoize columns to prevent unnecessary re-renders
  const columns = useMemo(() => createColumns(), []);

  // Extract unique categories for the filter dropdown - memoized
  const categories = useMemo(() => {
    const uniqueCategories = new Map();
    data.forEach((item) => {
      if (item.category && !uniqueCategories.has(item.category.id)) {
        uniqueCategories.set(item.category.id, item.category);
      }
    });
    return Array.from(uniqueCategories.values());
  }, [data]);

  // Memoize dataIds for DndContext
  const dataIds = useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  );

  // Optimize table initialization with memoization
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Optimize drag end handler with useCallback
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
        setData((data) => {
          const oldIndex = dataIds.indexOf(active.id);
          const newIndex = dataIds.indexOf(over.id);
          return arrayMove(data, oldIndex, newIndex);
        });
      }
    },
    [dataIds]
  );

  // Memoized filter handlers
  const handleTitleFilterChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      table.getColumn("title")?.setFilterValue(event.target.value);
    },
    [table]
  );

  // Memoized category filter handler
  const handleCategoryFilterChange = useCallback(
    (categoryName: string) => {
      table.getColumn("category.name")?.setFilterValue(categoryName);
    },
    [table]
  );

  // Memoized page size handler
  const handlePageSizeChange = useCallback(
    (value: string) => {
      table.setPageSize(Number(value));
    },
    [table]
  );

  return (
    <Tabs
      defaultValue="reports"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="reports">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="reports">All Reports</SelectItem>
            <SelectItem value="pending">Pending Review</SelectItem>
            <SelectItem value="investigation">Under Investigation</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="reports">All Reports</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Review
            {/* <Badge variant="secondary">3</Badge> */}
          </TabsTrigger>
          <TabsTrigger value="investigation">
            Under Investigation
            {/* <Badge variant="secondary">2</Badge> */}
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm">
            <Input
              placeholder="Search reports..."
              className="pl-8"
              value={
                (table.getColumn("title")?.getFilterValue() as string) ?? ""
              }
              onChange={handleTitleFilterChange}
            />
            <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          </div>

          {/* Category filter dropdown - optimized with memoized handler */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex gap-1">
                <span>Category</span>
                {table.getColumn("category.name")?.getFilterValue() ? (
                  <Badge variant="secondary" className="rounded-sm px-1">
                    1
                  </Badge>
                ) : null}
                <IconChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handleCategoryFilterChange("")}>
                All Categories
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category.id}
                  checked={
                    table.getColumn("category.name")?.getFilterValue() ===
                    category.name
                  }
                  onCheckedChange={() =>
                    handleCategoryFilterChange(category.name)
                  }
                >
                  {category.icon && (
                    <span className="mr-2">{category.icon}</span>
                  )}
                  {category.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <TabsContent
        value="reports"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        {/* Filter badges */}
        <div className="flex flex-wrap gap-2">
          {/* {table.getColumn("category.name")?.getFilterValue() && (
            <Badge variant="secondary" className="gap-1">
              Category: {table.getColumn("category.name")?.getFilterValue() as string}
              <Button 
                variant="ghost" 
                size="icon" 
                className="size-4 p-0 ml-1" 
                onClick={() => table.getColumn("category.name")?.setFilterValue("")}
              >
                <IconX className="size-3" />
                <span className="sr-only">Remove filter</span>
              </Button>
            </Badge>
          )} */}
        </div>

        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {/* Only render visible rows for better performance */}
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No reports found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <PaginationControls table={table} />
          </div>
        </div>
      </TabsContent>
      <TabsContent value="pending" className="flex flex-col px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table
                .getRowModel()
                .rows.filter((row) => row.original.status === "SUBMITTED")
                .length ? (
                table
                  .getRowModel()
                  .rows.filter((row) => row.original.status === "SUBMITTED")
                  .map((row) => (
                    <DraggableRow key={row.id} row={row} />
                  ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No pending reports found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
      <TabsContent value="investigation" className="flex flex-col px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table
                .getRowModel()
                .rows.filter(
                  (row) =>
                    row.original.status === "IN_PROGRESS" ||
                    row.original.status === "UNDER_REVIEW"
                )
                .length ? (
                table
                  .getRowModel()
                  .rows.filter(
                    (row) =>
                      row.original.status === "IN_PROGRESS" ||
                      row.original.status === "UNDER_REVIEW"
                  )
                  .map((row) => (
                    <DraggableRow key={row.id} row={row} />
                  ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No reports under investigation found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
      <TabsContent value="resolved" className="flex flex-col px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table
                .getRowModel()
                .rows.filter((row) => row.original.status === "RESOLVED")
                .length ? (
                table
                  .getRowModel()
                  .rows.filter((row) => row.original.status === "RESOLVED")
                  .map((row) => (
                    <DraggableRow key={row.id} row={row} />
                  ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No resolved reports found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// TableCellViewer component optimized with memoization
const TableCellViewer = React.memo(
  ({ item }: { item: z.infer<typeof schema> }) => {
    const isMobile = useIsMobile();

    return (
      <Drawer direction={isMobile ? "bottom" : "right"}>
        <DrawerTrigger asChild>
          <Button
            variant="link"
            className="text-foreground w-fit px-0 text-left"
          >
            {item.title} {/* Title should already be decrypted */}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="gap-1">
            <DrawerTitle>Report {item.trackingId}</DrawerTitle>
            <DrawerDescription>
              {item.title} - Submitted{" "}
              {new Date(item.createdAt).toLocaleDateString()}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
            <div className="grid gap-2">
              <div className="font-medium">Category</div>
              <div className="flex items-center gap-2">
                {item.category?.icon && <span>{item.category.icon}</span>}
                <span>{item.category?.name || "Uncategorized"}</span>
              </div>
            </div>
            <Separator />
            <div className="grid gap-2">
              <div className="font-medium">Report Details</div>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {item.content} {/* Content should already be decrypted */}
              </p>
            </div>
            <Separator />
            <div className="grid gap-2">
              <div className="font-medium">Status</div>
              <div className="flex items-center gap-2">
                {item.status === "RESOLVED" ? (
                  <IconCircleCheckFilled className="size-4 text-green-500" />
                ) : item.status === "IN_PROGRESS" ? (
                  <IconLoader className="size-4 text-blue-500 animate-spin" />
                ) : (
                  <IconClock className="size-4 text-yellow-500" />
                )}
                <span>
                  {item.status === "SUBMITTED"
                    ? "Pending Review"
                    : item.status === "IN_PROGRESS"
                    ? "Under Investigation"
                    : item.status === "RESOLVED"
                    ? "Resolved"
                    : item.status}
                </span>
              </div>
            </div>
            {item.evidenceCount && item.evidenceCount > 0 && (
              <>
                <Separator />
                <div className="grid gap-2">
                  <div className="font-medium">Evidence Files</div>
                  <div className="text-muted-foreground">
                    {item.evidenceCount}{" "}
                    {item.evidenceCount === 1 ? "file" : "files"} attached
                  </div>
                </div>
              </>
            )}
          </div>
          <DrawerFooter>
            <Link href={`/report/${item.trackingId}`} passHref>
              <Button className="w-full">View Full Report</Button>
            </Link>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }
);
TableCellViewer.displayName = "TableCellViewer";
