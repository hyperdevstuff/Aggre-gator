import { createFileRoute, useRouter } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { LogOut, Search } from "lucide-react";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_protected/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const { data: bookmarks, isLoading } = useBookmarks();

  const handleSignOut = async () => {
    await authClient.signOut();
    toast.success("signed out");
    router.invalidate();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/*search box with search icon*/}
          <Input className=""></Input>
          <Search />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>bookmarks</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">loading...</p>
            ) : bookmarks?.data?.length ? (
              <pre className="text-xs overflow-auto max-h-96 bg-muted p-4 rounded">
                {JSON.stringify(bookmarks.data, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground">no bookmarks yet</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
