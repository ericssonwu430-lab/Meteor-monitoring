import { NextResponse } from "next/server";
import { fetchSentryList } from "@/lib/nasa";

export const revalidate = 90;

export async function GET() {
  try {
    const data = await fetchSentryList();
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sentry fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
