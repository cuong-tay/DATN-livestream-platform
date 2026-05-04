const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/pages/admin/AdminPage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// The replacement logic:
const returnIndex = content.indexOf('  return (');

if (returnIndex !== -1) {
  // Splitting components 

  const prefix = content.substring(0, returnIndex);
  
  // We extract exactly what we need
  const newReturn = \  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row items-stretch">
      {/* Sidebar Layout */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card p-4 flex flex-col space-y-6 shrink-0 z-20">
        <div>
          <h1 className="text-2xl font-bold flex items-center justify-between md:justify-start gap-2">
            <div className="flex items-center gap-2 text-primary">
              <LayoutDashboard className="h-6 w-6" />
              <span>Admin Panel</span>
            </div>
            {/* Quick layout tools could go here if wanted */}
          </h1>
          <p className="text-xs text-muted-foreground hidden md:block mt-1">
            Qu?n tr? & Ki?m duy?t content
          </p>
        </div>

        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-none">
          <Button
            variant={activeTab === "categories" ? "default" : "ghost"}
            className="justify-start gap-2 whitespace-nowrap min-w-max md:min-w-0"
            onClick={() => setActiveTab("categories")}
          >
            <Tag className="h-5 w-5" />
            Qu?n lý Danh m?c
          </Button>

          <Button
            variant={activeTab === "reports" ? "default" : "ghost"}
            className="justify-start gap-2 whitespace-nowrap min-w-max md:min-w-0"
            onClick={() => setActiveTab("reports")}
          >
            <ShieldAlert className="h-5 w-5" />
            Ki?m duy?t Báo cáo
          </Button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full relative">
        {/* Sticky Header with Search */}
        <header className="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border bg-background/95 backdrop-blur px-4 py-4 md:px-8">
          <h2 className="text-xl md:text-2xl font-semibold text-foreground">
            {activeTab === "reports" ? "Báo cáo c?ng d?ng" : "Danh m?c h? th?ng"}
          </h2>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={activeTab === "reports" ? "Tìm user, lý do vi ph?m..." : "Tìm tên danh m?c..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full bg-background"
            />
          </div>
        </header>

        <div className="p-4 md:p-8 mx-auto max-w-6xl space-y-6 pb-24">
          {\ + "{activeTab === 'categories' && (\n" + \            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">\ + 
          content.substring(content.indexOf('<Card>', returnIndex), content.indexOf('</Card>', returnIndex) + 7).replace('<Card>', '<Card className="border-none shadow-none md:border md:shadow-sm">') + \
            </div>
          )}\ + \

          \ + "{activeTab === 'reports' && (\n" + \            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card className="border-none shadow-none md:border md:shadow-sm md:col-span-4 lg:col-span-1 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-primary">Tác v?</CardTitle>
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
                      Làm m?i reports
                    </Button>
                  </CardContent>
                </Card>
\ + 
          content.substring(content.indexOf('<Card>', content.indexOf('grid-cols-3')), content.indexOf('</SelectTrigger>', returnIndex)).replace(/<Card>/g, '<Card className="border-none shadow-none md:border md:shadow-sm">') + \
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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
          </CardHeader>\ + 
          content.substring(content.indexOf('<CardContent className="space-y-4">', returnIndex), content.lastIndexOf('</Card>')) + \
                </Card>
            </div>
          )}\ + \
        </div>
      </main>\ + 
      content.substring(content.indexOf('<Dialog'), content.lastIndexOf('</div>')) + \
    </div>
  );
}
\

  fs.writeFileSync(filePath, prefix + newReturn, 'utf-8');
  console.log("Rewrite complete.");
} else {
  console.log("Could not find 'return ('");
}
