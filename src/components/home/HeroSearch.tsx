import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HeroSearch() {
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const valid = from !== "" && to !== "" && from <= to;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) navigate(`/motor?from=${from}&to=${to}`);
      }}
      className="mt-8 flex max-w-2xl flex-col gap-3 rounded-xl bg-white p-3 text-neutral-900 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <p className="mb-1 text-xs font-medium text-neutral-500">
          Tanggal ambil
        </p>
        <Input
          type="date"
          min={today}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          required
        />
      </div>
      <div className="flex-1">
        <p className="mb-1 text-xs font-medium text-neutral-500">
          Tanggal kembali
        </p>
        <Input
          type="date"
          min={from || today}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={!valid}>
        <Search className="mr-2 h-4 w-4" /> Cari motor
      </Button>
    </form>
  );
}
