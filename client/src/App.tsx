import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { queryClient } from "@/lib/query-client";
import { SubmitButton } from "./components/custom/submit-button";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <SubmitButton loading={false}> test </SubmitButton>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
