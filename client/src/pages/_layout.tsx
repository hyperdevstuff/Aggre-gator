import { Outlet, Link } from "react-router-dom";
import { ModeToggle } from "@/components/toogle-theme";

export function RootLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <nav className="flex gap-4">
            <Link to="/" className="hover:underline">
              home
            </Link>
            <Link to="/dashboard" className="hover:underline">
              dashboard
            </Link>
            <Link to="/about" className="hover:underline">
              about
            </Link>
          </nav>
          <ModeToggle />
        </div>
      </header>
      <main className="container mx-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
