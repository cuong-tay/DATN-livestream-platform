import { Outlet } from "react-router-dom";
import { Header } from "../header/Header";

export function Layout() {
  return (
    <div
      className="min-h-screen bg-background text-foreground flex flex-col sm:flex-row"
      style={{ paddingTop: "var(--app-header-offset)" }}
    >
      <Header />
      <main className="flex-1 overflow-y-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
