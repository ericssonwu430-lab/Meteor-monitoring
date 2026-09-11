import { NextResponse } from "next/server";
import { fetchFireballs, parseFireballRows } from "@/lib/nasa";

export const revalidate = 120;

export async function GET() {
  try {
    const raw = await fetchFireballs(50);
    const fireballs = parseFireballRows(raw);
    return NextResponse.json({
      signature: raw.signature,
      count: raw.count,
      fireballs,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fireball fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
