import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { db } from "@/lib/firebase";

interface Review {
  id: string;
  name: string;
  text: string;
  rating: number;
}

async function getReviews(): Promise<Review[]> {
  const snap = await getDocs(
    query(collection(db, "reviews"), where("isApproved", "==", true), limit(6))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
}

export default function Testimonials() {
  const { data = [] } = useQuery({
    queryKey: ["reviews"],
    queryFn: getReviews,
    staleTime: 5 * 60_000,
  });
  if (data.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-2xl font-bold">Kata Pelanggan</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {data.map((r) => (
          <figure key={r.id} className="rounded-xl border bg-white p-5">
            <div
              className="flex gap-0.5 text-primary"
              aria-label={`${r.rating} dari 5`}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(r.rating)
                      ? "fill-current"
                      : "text-neutral-300"
                  }`}
                />
              ))}
            </div>
            <blockquote className="mt-3 text-sm text-neutral-600">
              {r.text}
            </blockquote>
            <figcaption className="mt-3 text-sm font-semibold">
              {r.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
