import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MotorType } from "@/types";

const col = collection(db, "motorTypes");

export async function getActiveMotors(): Promise<MotorType[]> {
  const snap = await getDocs(query(col, where("isActive", "==", true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MotorType));
}

export async function getMotorBySlug(slug: string): Promise<MotorType | null> {
  const snap = await getDocs(
    query(
      col,
      where("slug", "==", slug),
      where("isActive", "==", true),
      limit(1)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as MotorType;
}
