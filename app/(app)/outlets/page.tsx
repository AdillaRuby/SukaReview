import { createClient } from "@/lib/supabase/server";
import { getAllOutlets } from "@/lib/outlets/queries";
import { OutletsExplorer } from "@/components/outlets/outlets-explorer";

export default async function OutletsPage() {
  const supabase = await createClient();
  const outlets = await getAllOutlets(supabase);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-semibold text-foreground">Outlets</h1>
        <p className="text-sm text-muted-foreground">{outlets.length} outlet Suka Shawarma terdaftar.</p>
      </div>
      <OutletsExplorer initialOutlets={outlets} />
    </div>
  );
}
