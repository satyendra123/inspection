import { Outlet } from "react-router-dom";
import { SidebarProvider } from "../context/SidebarContext";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

const LayoutContent: React.FC = () => {
  return (
    <div className="min-h-screen text-slate-800">
      <AppSidebar />
      <Backdrop />

      <div className="min-h-screen lg:ml-72">
        <AppHeader />
        <main className="app-content min-w-0 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;
