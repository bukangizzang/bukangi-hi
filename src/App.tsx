import { AppShortcutProvider } from "@/components/shortcut-provider";
import { Toaster } from "@/components/ui/sonner";
import { HomePage } from "@/pages/home";

// Single-screen game: title → play → result state machine lives in HomePage.
export function App() {
  return (
    <AppShortcutProvider>
      <div className="flex min-h-screen flex-col">
        <main className="flex flex-1 flex-col">
          <HomePage />
        </main>
        <Toaster />
      </div>
    </AppShortcutProvider>
  );
}
