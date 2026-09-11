import { NextResponse } from "next/server";
import { fetchSentryObject } from "@/lib/nasa";

export const revalidate = 90;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ des: string }> }
) {
  try {
    const { des: raw } = await ctx.params;
    const des = decodeURIComponent(raw);
    const data = await fetchSentryObject(des);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sentry object fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
