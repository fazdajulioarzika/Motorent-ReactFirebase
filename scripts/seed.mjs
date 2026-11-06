import { readFileSync } from "node:fs"
import { initializeApp, cert } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"

const keyPath = process.argv[2]
if (!keyPath) throw new Error("Pakai: node scripts/seed.mjs <path-service-account.json>")

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) })
const db = getFirestore()

const motors = [
  { name: "Honda Vario 160", brand: "Honda", category: "scooter", dailyPrice: 100000,
    specifications: { mesin: "160cc", transmisi: "Otomatis", bagasi: "Luas" } },
  { name: "Honda Beat", brand: "Honda", category: "scooter", dailyPrice: 75000,
    specifications: { mesin: "110cc", transmisi: "Otomatis", bagasi: "Sedang" } },
  { name: "Yamaha NMAX", brand: "Yamaha", category: "scooter", dailyPrice: 150000,
    specifications: { mesin: "155cc", transmisi: "Otomatis", bagasi: "Luas" } },
  { name: "Honda CRF150L", brand: "Honda", category: "trail", dailyPrice: 175000,
    specifications: { mesin: "150cc", transmisi: "Manual", bagasi: "Tidak ada" } },
]

for (const m of motors) {
  const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  await db.collection("motorTypes").doc(slug).set({
    ...m, slug, images: [], isActive: true,
    description: `${m.name} siap untuk sewa harian.`,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  })
  console.log("OK", slug)
}
