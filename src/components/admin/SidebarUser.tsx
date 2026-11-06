import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import { ROLE_LABEL } from "@/components/admin/nav-config";

export default function SidebarUser({
  email,
  role,
}: {
  email: string;
  role: string;
}) {
  return (
    <div className="shrink-0 border-t border-neutral-800 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-white">
          {email.charAt(0) || "A"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{email}</p>
          <p className="text-xs text-neutral-400">{ROLE_LABEL[role] ?? role}</p>
        </div>
        <button
          type="button"
          title="Keluar"
          aria-label="Keluar"
          onClick={() => signOut(auth)}
          className="rounded-md p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
