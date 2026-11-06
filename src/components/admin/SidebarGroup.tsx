import { NavLink } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { navLinkClass, type NavGroup } from "@/components/admin/nav-config";

interface Props {
  group: NavGroup;
  expanded: boolean;
  hasActive: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}

export default function SidebarGroup({
  group,
  expanded,
  hasActive,
  onToggle,
  onNavigate,
}: Props) {
  return (
    <div className="pt-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-white ${
          hasActive ? "text-white" : "text-neutral-500"
        }`}
      >
        {group.label}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`grid transition-all duration-200 ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <ul className="ml-3 mt-1 space-y-1 border-l border-neutral-800 pl-2">
            {group.items.map((i) => (
              <li key={i.to}>
                <NavLink
                  to={i.to}
                  className={navLinkClass}
                  onClick={onNavigate}
                  tabIndex={expanded ? 0 : -1}
                >
                  <i.icon className="h-4 w-4 shrink-0" />
                  {i.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
