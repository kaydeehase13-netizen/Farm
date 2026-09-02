import { Sidebar, TopBar } from "@/components/nav/sidebar";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        <TopBar />
        <main className="flex-1 px-4 md:px-8 py-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
      <AssistantPanel />
    </div>
  );
}
