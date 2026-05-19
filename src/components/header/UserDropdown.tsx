import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleDropdown = () => setIsOpen((prev) => !prev);
  const closeDropdown = () => setIsOpen(false);

  const handleEditProfile = () => {
    closeDropdown();
    navigate("/user");
  };

  const handleLogout = async () => {
    closeDropdown();
    await logout();
  };

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <span className="flex h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
          <img
            src={user?.avatar || "/images/user/owner.jpg"}
            alt="User"
            className="h-full w-full object-cover"
          />
        </span>
        <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
          <span className="truncate text-sm font-semibold text-slate-800">
            {user?.name || "John Doe"}
          </span>
          <span className="text-[11px] text-slate-500">{user?.role || "Admin"}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] w-[min(260px,calc(100vw-1rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-theme-lg"
      >
        <div>
          <span className="block font-medium text-slate-700">{user?.name || "John Doe"}</span>
          <span className="text-sm text-slate-500">{user?.role || "Admin"}</span>
        </div>

        <ul className="flex flex-col gap-1 border-b border-slate-100 pb-3 pt-4">
          <li>
            <DropdownItem
              onItemClick={handleEditProfile}
              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
            >
              Edit profile
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={() => navigate("/user")}
              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
            >
              Account settings
            </DropdownItem>
          </li>
        </ul>

        <button
          onClick={handleLogout}
          className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
        >
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}
