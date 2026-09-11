import { NextResponse } from "next/server";
import { fetchSbdb, parseOrbitElements } from "@/lib/nasa";

export const revalidate = 300;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ des: string }> }
) {
  try {
    const { des: raw } = await ctx.params;
    const des = decodeURIComponent(raw);
    const data = await fetchSbdb(des);
    const orbit = parseOrbitElements(data);
    return NextResponse.json({ raw: data, orbit });
  } catch (e) {
    const message = e instanceof Error ? e.message : "SBDB fetch failed";
    return NextResponse.json(
      {
        error: message,
        orbit: {
          a: null,
          e: null,
          i: null,
          om: null,
          w: null,
          ma: null,
          q: null,
          ad: null,
          orbitClass: null,
          orbitClassCode: null,
          designation: null,
          fullname: null,
          firstObs: null,
          lastObs: null,
          dataArc: null,
          moid: null,
          available: false,
          error: message,
        },
      },
      { status: 502 }
    );
  }
}
