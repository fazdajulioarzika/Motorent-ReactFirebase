import { doc, getDoc } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/firebase";

export interface PublicSettings {
  rental: {
    name: string;
    address: string;
    whatsapp: string;
    email: string;
    openHour: number;
    closeHour: number;
  };
  policy: {
    dpPercent: number;
    depositAmount: number;
    toleranceMinutes: number;
    minDays: number;
    maxDays: number;
    paymentExpiryMinutes: number;
    lateFeePerHour: number;
  };
}

const FALLBACK: PublicSettings = {
  rental: {
    name: "MotoRent",
    address: "",
    whatsapp: "",
    email: "",
    openHour: 7,
    closeHour: 21,
  },
  policy: {
    dpPercent: 30,
    depositAmount: 0,
    toleranceMinutes: 60,
    minDays: 1,
    maxDays: 30,
    paymentExpiryMinutes: 120,
    lateFeePerHour: 10000,
  },
};

export function useSettings(): PublicSettings {
  const { data } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "settings", "public"));
      return snap.exists() ? (snap.data() as Partial<PublicSettings>) : null;
    },
    staleTime: 5 * 60_000,
  });
  return {
    rental: { ...FALLBACK.rental, ...(data?.rental ?? {}) },
    policy: { ...FALLBACK.policy, ...(data?.policy ?? {}) },
  };
}
