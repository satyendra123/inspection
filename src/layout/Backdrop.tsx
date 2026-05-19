import { useSidebar } from "../context/SidebarContext";

const Backdrop: React.FC = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();

  if (!isMobileOpen) return null;

  return (
    <div
      className="mobile-overlay fixed inset-0 z-30 bg-black/30 lg:hidden"
      onClick={toggleMobileSidebar}
    />
  );
};

export default Backdrop;
