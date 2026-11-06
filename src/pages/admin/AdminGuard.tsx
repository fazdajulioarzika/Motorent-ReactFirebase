import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AdminShell from "@/components/admin/AdminShell";

const ROLES = ["super_admin", "admin", "staff"];

type State =
  | { status: "loading" }
  | { status: "out" }
  | { status: "in"; email: string; role: string };

export default function AdminGuard() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return setState({ status: "out" });
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const role = String(snap.data()?.role ?? "");
        if (ROLES.includes(role)) {
          setState({ status: "in", email: user.email ?? "", role });
        } else {
          await signOut(auth);
          setState({ status: "out" });
        }
      } catch {
        await signOut(auth);
        setState({ status: "out" });
      }
    });
  }, []);

  if (state.status === "loading")
    return <p className="p-10 text-center text-neutral-500">Memuat...</p>;
  if (state.status === "out") return <Navigate to="/admin/login" replace />;

  return <AdminShell email={state.email} role={state.role} />;
}
