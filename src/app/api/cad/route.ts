import { NextResponse } from "next/server";
import { fetchCad, parseCadRows } from "@/lib/nasa";

export const revalidate = 90;

export async function GET() {
  try {
    const raw = await fetchCad();
    const approaches = parseCadRows(raw);
    return NextResponse.json({
      signature: raw.signature,
      count: raw.count,
      approaches,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "CAD fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
