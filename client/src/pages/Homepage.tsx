import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome Home</CardTitle>
          <CardDescription>
            This is a card component from shadcn/ui. It will adapt to the theme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button>Click Me</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export { HomePage };
