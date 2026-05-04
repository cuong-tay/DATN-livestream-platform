import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Flag,
  LayoutDashboard,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  categoryService,
  type CategoryItem,
  type UpsertCategoryRequest,
} from "@/shared/api/category.service";
import {
  reportService,
  type ModerateReportRequest,
  type ReportItem,
  type ReportStatus,
} from "@/shared/api/report.service";
import { extractApiErrorMessage, hasHttpStatus } from "@/shared/api/httpClient";
import { useI18n, useI18nFormatters, type TranslationKey } from "@/shared/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

const PAGE_SIZE = 8;
const CATEGORY_NAME_MAX_LENGTH = 100;
const CATEGORY_ICON_URL_MAX_LENGTH = 500;

type ReportStatusFilter = ReportStatus | "ALL";

const FILTER_OPTIONS: Array<{ value: ReportStatusFilter; labelKey: TranslationKey }> = [
  { value: "ALL", labelKey: "admin.filter.all" },
  { value: "PENDING", labelKey: "admin.status.pending" },
  { value: "RESOLVED", labelKey: "admin.status.resolved" },
  { value: "DISMISSED", labelKey: "admin.status.dismissed" },
];

function statusLabelKey(status: ReportStatus): TranslationKey {
  switch (status) {
    case "PENDING":
      return "admin.status.pending";
    case "RESOLVED":
      return "admin.status.resolved";
    case "DISMISSED":
      return "admin.status.dismissed";
    default:
      return "admin.status.pending";
  }
}

function statusBadgeVariant(
  status: ReportStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "RESOLVED":
      return "default";
    case "DISMISSED":
      return "destructive";
    default:
      return "outline";
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function validateCategoryInput(
  name: string,
  iconUrl: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string | null {
  const normalizedName = name.trim();
  const normalizedIconUrl = iconUrl.trim();

  if (!normalizedName) {
    return t("admin.validation.nameRequired");
  }

  if (normalizedName.length > CATEGORY_NAME_MAX_LENGTH) {
    return t("admin.validation.nameMax", { max: CATEGORY_NAME_MAX_LENGTH });
  }

  if (normalizedIconUrl.length > CATEGORY_ICON_URL_MAX_LENGTH) {
    return t("admin.validation.iconMax", { max: CATEGORY_ICON_URL_MAX_LENGTH });
  }

  if (normalizedIconUrl && !isHttpUrl(normalizedIconUrl)) {
    return t("admin.validation.iconInvalid");
  }

  return null;
}

function buildCategoryPayload(name: string, iconUrl: string): UpsertCategoryRequest {
  const normalizedName = name.trim();
  const normalizedIconUrl = iconUrl.trim();

  return {
    name: normalizedName,
    iconUrl: normalizedIconUrl.length > 0 ? normalizedIconUrl : undefined,
  };
}

function isDuplicateCategoryNameError(error: unknown): boolean {
  return hasHttpStatus(error, 409) || hasHttpStatus(error, 400);
}

export function AdminPage() {
  const { t } = useI18n();
  const { formatDate } = useI18nFormatters();
  const [activeTab, setActiveTab] = useState<"reports" | "categories">("reports");
  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>("PENDING");
  const [currentPage, setCurrentPage] = useState(0);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingReportId, setProcessingReportId] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isCategoriesRefreshing, setIsCategoriesRefreshing] = useState(false);
  const [categoryErrorMessage, setCategoryErrorMessage] = useState<string | null>(null);
  const [createCategoryName, setCreateCategoryName] = useState("");
  const [createCategoryIconUrl, setCreateCategoryIconUrl] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryIconUrl, setEditCategoryIconUrl] = useState("");
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  const loadReports = useCallback(
    async (mode: "full" | "refresh" = "full") => {
      if (mode === "full") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setErrorMessage(null);

      try {
        const response = await reportService.getAdminReports({
          status: statusFilter === "ALL" ? undefined : statusFilter,
          page: currentPage,
          size: PAGE_SIZE,
        });

        const payload = response.data;
        setReports(payload.content ?? []);
        setTotalElements(payload.totalElements ?? 0);
        setTotalPages(payload.totalPages ?? 0);

        setAdminNotes((previous) => {
          const next = { ...previous };
          for (const report of payload.content ?? []) {
            if (next[report.id] === undefined) {
              next[report.id] = report.adminNote ?? "";
            }
          }
          return next;
        });
      } catch (error) {
        setErrorMessage(extractApiErrorMessage(error));
      } finally {
        if (mode === "full") {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [currentPage, statusFilter],
  );

  const loadCategories = useCallback(async (mode: "full" | "refresh" = "full") => {
    if (mode === "full") {
      setIsCategoriesLoading(true);
    } else {
      setIsCategoriesRefreshing(true);
    }
    setCategoryErrorMessage(null);

    try {
      const response = await categoryService.getAll();
      const nextCategories = Array.isArray(response.data)
        ? [...response.data].sort((left, right) => left.id - right.id)
        : [];
      setCategories(nextCategories);
    } catch (error) {
      setCategoryErrorMessage(extractApiErrorMessage(error));
    } finally {
      if (mode === "full") {
        setIsCategoriesLoading(false);
      } else {
        setIsCategoriesRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadReports("full");
  }, [loadReports]);

  useEffect(() => {
    void loadCategories("full");
  }, [loadCategories]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    return categories.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.iconUrl && c.iconUrl.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [categories, searchQuery]);

  const filteredReports = useMemo(() => {
    if (!searchQuery) return reports;
    return reports.filter(
      (r) =>
        r.reporterUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reportedUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reason.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [reports, searchQuery]);

  const pendingCountOnPage = useMemo(
    () => filteredReports.filter((report) => report.status === "PENDING").length,
    [filteredReports],
  );
  const resolvedCountOnPage = useMemo(
    () => filteredReports.filter((report) => report.status === "RESOLVED").length,
    [filteredReports],
  );
  const dismissedCountOnPage = useMemo(
    () => filteredReports.filter((report) => report.status === "DISMISSED").length,
    [filteredReports],
  );
  const totalCategoryRoomCount = useMemo(
    () => categories.reduce((accumulator, category) => accumulator + (category.roomCount ?? 0), 0),
    [categories],
  );

  const effectiveTotalPages = Math.max(totalPages, 1);
  const hasPrevPage = currentPage > 0;
  const hasNextPage = currentPage + 1 < effectiveTotalPages;
  const isCategoryActionBusy =
    isCreatingCategory || isUpdatingCategory || isDeletingCategory || isCategoriesRefreshing;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return dateStr;
    }
    return formatDate(date, {
      dateStyle: "short",
      timeStyle: "short",
      hour12: false,
    });
  };

  const handleFilterChange = (value: string) => {
    setStatusFilter(value as ReportStatusFilter);
    setCurrentPage(0);
  };

  const closeEditCategoryDialog = () => {
    if (isUpdatingCategory) {
      return;
    }

    setEditingCategory(null);
    setEditCategoryName("");
    setEditCategoryIconUrl("");
  };

  const handleCreateCategory = async () => {
    const validationMessage = validateCategoryInput(createCategoryName, createCategoryIconUrl, t);

    if (validationMessage) {
      setCategoryErrorMessage(validationMessage);
      toast.error(validationMessage);
      return;
    }

    setIsCreatingCategory(true);
    setCategoryErrorMessage(null);

    try {
      const payload = buildCategoryPayload(createCategoryName, createCategoryIconUrl);
      const response = await categoryService.create(payload);

      setCreateCategoryName("");
      setCreateCategoryIconUrl("");
      toast.success(t("admin.toast.categoryCreated", { name: response.data.name }));
      await loadCategories("refresh");
    } catch (error) {
      const message = isDuplicateCategoryNameError(error)
        ? t("admin.toast.duplicateCategory")
        : extractApiErrorMessage(error);
      setCategoryErrorMessage(message);
      toast.error(message);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const openEditCategoryDialog = (category: CategoryItem) => {
    setCategoryErrorMessage(null);
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditCategoryIconUrl(category.iconUrl ?? "");
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) {
      return;
    }

    const validationMessage = validateCategoryInput(editCategoryName, editCategoryIconUrl, t);

    if (validationMessage) {
      setCategoryErrorMessage(validationMessage);
      toast.error(validationMessage);
      return;
    }

    setIsUpdatingCategory(true);
    setCategoryErrorMessage(null);

    try {
      const payload = buildCategoryPayload(editCategoryName, editCategoryIconUrl);
      const response = await categoryService.update(editingCategory.id, payload);

      toast.success(t("admin.toast.categoryUpdated", { name: response.data.name }));
      closeEditCategoryDialog();
      await loadCategories("refresh");
    } catch (error) {
      const message = isDuplicateCategoryNameError(error)
        ? t("admin.toast.duplicateCategory")
        : extractApiErrorMessage(error);
      setCategoryErrorMessage(message);
      toast.error(message);
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) {
      return;
    }

    const targetCategory = categoryToDelete;
    setIsDeletingCategory(true);
    setCategoryErrorMessage(null);

    try {
      await categoryService.remove(targetCategory.id);
      toast.success(t("admin.toast.categoryDeleted", { name: targetCategory.name }));
      setCategoryToDelete(null);
      await loadCategories("refresh");
    } catch (error) {
      const message = hasHttpStatus(error, 400)
        ? t("admin.toast.categoryInUse")
        : extractApiErrorMessage(error);
      setCategoryErrorMessage(message);
      toast.error(message);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const handleModerateReport = async (
    report: ReportItem,
    nextStatus: Exclude<ReportStatus, "PENDING">,
  ) => {
    setProcessingReportId(report.id);
    setErrorMessage(null);

    const payload: ModerateReportRequest = {
      status: nextStatus,
      adminNote: adminNotes[report.id]?.trim() || undefined,
    };

    try {
      const response = await reportService.moderate(report.id, payload);
      const updatedReport = response.data;

      if (updatedReport && typeof updatedReport.id === "number") {
        setReports((previous) =>
          previous.map((item) => (item.id === updatedReport.id ? updatedReport : item)),
        );
      } else {
        await loadReports("refresh");
      }

      toast.success(
        nextStatus === "RESOLVED"
          ? t("admin.toast.reportResolved", { id: report.id })
          : t("admin.toast.reportDismissed", { id: report.id }),
      );
    } catch (error) {
      const message = extractApiErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setProcessingReportId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row items-stretch">
      {/* Sidebar Layout */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card p-4 flex flex-col space-y-6 shrink-0 z-20 md:sticky top-0 h-auto md:h-screen">
        <div>
          <h1 className="text-2xl font-bold flex items-center justify-between md:justify-start gap-2">
            <div className="flex items-center gap-2 text-primary">
              <LayoutDashboard className="h-6 w-6" />
              <span>{t("admin.title")}</span>
            </div>
          </h1>
          <p className="text-xs text-muted-foreground hidden md:block mt-1">
            {t("admin.subtitle")}
          </p>
        </div>

        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-none">
          <Button
            variant={activeTab === "categories" ? "default" : "ghost"}
            className="justify-start gap-2 whitespace-nowrap min-w-max md:min-w-0"
            onClick={() => setActiveTab("categories")}
          >
            <Tag className="h-5 w-5" />
            {t("admin.nav.categories")}
          </Button>
          <Button
            variant={activeTab === "reports" ? "default" : "ghost"}
            className="justify-start gap-2 whitespace-nowrap min-w-max md:min-w-0"
            onClick={() => setActiveTab("reports")}
          >
            <ShieldAlert className="h-5 w-5" />
            {t("admin.nav.reports")}
          </Button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full relative">
        <header className="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border bg-background/95 backdrop-blur px-4 py-4 md:px-8">
          <h2 className="text-xl md:text-2xl font-semibold text-foreground">
            {activeTab === "reports" ? t("admin.header.reports") : t("admin.header.categories")}
          </h2>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={activeTab === "reports" ? t("admin.search.reports") : t("admin.search.categories")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full bg-background"
            />
          </div>
        </header>

        <div className="p-4 md:p-8 mx-auto max-w-6xl space-y-6 pb-24">
          {activeTab === 'categories' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
              <Card className="border-none shadow-none border border-border md:shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  {t("admin.categories.title")}
                </CardTitle>
                <CardDescription>
                  {t("admin.categories.description")}
                </CardDescription>
                <p className="text-xs text-muted-foreground">
                  {t("admin.categories.summary", {
                    count: filteredCategories.length,
                    rooms: totalCategoryRoomCount,
                  })}
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  void loadCategories("refresh");
                }}
                disabled={isCategoriesRefreshing || isCategoriesLoading}
              >
                {isCategoriesRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {t("admin.categories.sync")}
              </Button>
            </div>

            {categoryErrorMessage && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{categoryErrorMessage}</span>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="space-y-2 md:col-span-4">
                  <Label htmlFor="new-category-name">{t("admin.categories.name")}</Label>
                  <Input
                    id="new-category-name"
                    value={createCategoryName}
                    maxLength={CATEGORY_NAME_MAX_LENGTH}
                    onChange={(event) => setCreateCategoryName(event.target.value)}
                    placeholder={t("admin.categories.namePlaceholder")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {createCategoryName.trim().length}/{CATEGORY_NAME_MAX_LENGTH}
                  </p>
                </div>

                <div className="space-y-2 md:col-span-6">
                  <Label htmlFor="new-category-icon">{t("admin.categories.iconUrl")}</Label>
                  <Input
                    id="new-category-icon"
                    value={createCategoryIconUrl}
                    maxLength={CATEGORY_ICON_URL_MAX_LENGTH}
                    onChange={(event) => setCreateCategoryIconUrl(event.target.value)}
                    placeholder={t("admin.categories.iconUrlPlaceholder")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {createCategoryIconUrl.trim().length}/{CATEGORY_ICON_URL_MAX_LENGTH}
                  </p>
                </div>

                <div className="md:col-span-2 md:self-end">
                  <Button
                    className="w-full"
                    onClick={() => {
                      void handleCreateCategory();
                    }}
                    disabled={isCategoryActionBusy || isCategoriesLoading}
                  >
                    {isCreatingCategory ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {t("admin.categories.create")}
                  </Button>
                </div>
              </div>
            </div>

            {isCategoriesLoading ? (
              <div className="flex min-h-40 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
                {t("admin.categories.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[70px]">ID</TableHead>
                      <TableHead className="min-w-[220px]">{t("admin.categories.tableName")}</TableHead>
                      <TableHead className="w-[140px]">Icon</TableHead>
                      <TableHead className="w-[120px]">{t("admin.categories.tableRooms")}</TableHead>
                      <TableHead className="w-[220px] text-right">{t("admin.categories.tableActions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">#{category.id}</TableCell>
                        <TableCell>
                          <p className="font-medium">{category.name}</p>
                          {category.iconUrl && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{category.iconUrl}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {category.iconUrl ? (
                            <img
                              src={category.iconUrl}
                              alt={category.name}
                              className="h-10 w-10 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-sm font-semibold text-muted-foreground">
                              {category.name[0]?.toUpperCase() ?? "#"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{category.roomCount}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isCategoryActionBusy}
                              onClick={() => openEditCategoryDialog(category)}
                            >
                              <PencilLine className="h-4 w-4" />
                              {t("admin.categories.edit")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isCategoryActionBusy}
                              onClick={() => setCategoryToDelete(category)}
                            >
                              <Trash2 className="h-4 w-4" />
                              {t("admin.categories.delete")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {activeTab === 'reports' && (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="border-none shadow-none md:border md:shadow-sm md:col-span-4 lg:col-span-1 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary">{t("admin.reports.actionsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full text-sm"
                onClick={() => {
                  void loadReports("refresh");
                }}
                disabled={isRefreshing || isLoading}
              >
                {isRefreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t("admin.reports.refresh")}
              </Button>
            </CardContent>
          </Card>
          <Card className="border-none shadow-none md:border md:shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{t("admin.reports.pendingPage")}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Clock3 className="h-5 w-5 text-amber-500" />
                {pendingCountOnPage}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-none md:border md:shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{t("admin.reports.resolvedPage")}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                {resolvedCountOnPage}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-none md:border md:shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{t("admin.reports.dismissedPage")}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Flag className="h-5 w-5 text-rose-500" />
                {dismissedCountOnPage}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="border-none shadow-none md:border md:shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{t("admin.reports.title")}</CardTitle>
                <CardDescription>{t("admin.reports.total", { count: totalElements })}</CardDescription>
              </div>
              <div className="w-full md:w-[220px]">
                <Select value={statusFilter} onValueChange={handleFilterChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("admin.reports.filterPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
                {t("admin.reports.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>{t("admin.reports.reporter")}</TableHead>
                      <TableHead>{t("admin.reports.reported")}</TableHead>
                      <TableHead className="min-w-[260px]">{t("admin.reports.reason")}</TableHead>
                      <TableHead>{t("admin.reports.status")}</TableHead>
                      <TableHead>{t("admin.reports.createdAt")}</TableHead>
                      <TableHead className="min-w-[220px]">{t("admin.reports.adminNote")}</TableHead>
                      <TableHead className="w-[190px] text-right">{t("admin.reports.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => {
                      const isPending = report.status === "PENDING";
                      const isProcessing = processingReportId === report.id;

                      return (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">#{report.id}</TableCell>
                          <TableCell>{report.reporterUsername}</TableCell>
                          <TableCell>{report.reportedUsername}</TableCell>
                          <TableCell className="max-w-[340px] whitespace-normal break-words text-sm text-muted-foreground">
                            {report.reason}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(report.status)}>
                              {t(statusLabelKey(report.status))}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{formatDateTime(report.createdAt)}</TableCell>
                          <TableCell>
                            <Input
                              placeholder={t("admin.reports.notePlaceholder")}
                              value={adminNotes[report.id] ?? ""}
                              onChange={(event) =>
                                setAdminNotes((previous) => ({
                                  ...previous,
                                  [report.id]: event.target.value,
                                }))
                              }
                              disabled={!isPending || isProcessing}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {isPending ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    void handleModerateReport(report, "RESOLVED");
                                  }}
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                  {t("admin.reports.approve")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    void handleModerateReport(report, "DISMISSED");
                                  }}
                                  disabled={isProcessing}
                                >
                                  <XCircle className="h-4 w-4" />
                                  {t("admin.reports.dismiss")}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {report.resolvedAt ? formatDateTime(report.resolvedAt) : t("admin.reports.processed")}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-3 md:flex-row md:items-center md:justify-between">
              <span className="text-sm text-muted-foreground">
                {t("admin.pagination.page", {
                  current: Math.min(currentPage + 1, effectiveTotalPages),
                  total: effectiveTotalPages,
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((previous) => Math.max(previous - 1, 0))}
                  disabled={!hasPrevPage || isLoading || isRefreshing}
                >
                  {t("admin.pagination.prev")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((previous) => previous + 1)}
                  disabled={!hasNextPage || isLoading || isRefreshing}
                >
                  {t("admin.pagination.next")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      </div>
    </main>

      <Dialog
        open={editingCategory !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditCategoryDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.dialog.editTitle")}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? t("admin.dialog.editDescription", { id: editingCategory.id })
                : t("admin.dialog.editFallback")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">{t("admin.categories.name")}</Label>
              <Input
                id="edit-category-name"
                value={editCategoryName}
                maxLength={CATEGORY_NAME_MAX_LENGTH}
                onChange={(event) => setEditCategoryName(event.target.value)}
                placeholder={t("admin.dialog.editNamePlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {editCategoryName.trim().length}/{CATEGORY_NAME_MAX_LENGTH}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category-icon">{t("admin.categories.iconUrlShort")}</Label>
              <Input
                id="edit-category-icon"
                value={editCategoryIconUrl}
                maxLength={CATEGORY_ICON_URL_MAX_LENGTH}
                onChange={(event) => setEditCategoryIconUrl(event.target.value)}
                placeholder={t("admin.dialog.editIconPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {editCategoryIconUrl.trim().length}/{CATEGORY_ICON_URL_MAX_LENGTH}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditCategoryDialog} disabled={isUpdatingCategory}>
              {t("actions.cancel")}
            </Button>
            <Button
              onClick={() => {
                void handleUpdateCategory();
              }}
              disabled={isUpdatingCategory}
            >
              {isUpdatingCategory ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PencilLine className="h-4 w-4" />
              )}
              {t("admin.dialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingCategory) {
            setCategoryToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.dialog.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {categoryToDelete
                ? t("admin.dialog.deleteDescription", { name: categoryToDelete.name })
                : t("admin.dialog.deleteFallback")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCategory}>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="gap-2"
              disabled={isDeletingCategory}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteCategory();
              }}
            >
              {isDeletingCategory ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t("admin.dialog.deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
