import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>metric 1</CardTitle>
            <CardDescription>some description</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>metric 2</CardTitle>
            <CardDescription>another metric</CardDescription>
          </CardHeader>
          <CardContent>
            <Button>action</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
