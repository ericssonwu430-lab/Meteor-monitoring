import { NextResponse } from "next/server";
import {
  HORIZONS_REVALIDATE,
  HorizonsResolveError,
  fetchHorizonsObserver,
} from "@/lib/horizons";

export const revalidate = 1800;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ des: string }> }
) {
  try {
    const { des: raw } = await ctx.params;
    const des = decodeURIComponent(raw);
    try {
      const ephemeris = await fetchHorizonsObserver(des);
      return NextResponse.json(ephemeris, {
        headers: {
          "Cache-Control": `public, s-maxage=${HORIZONS_REVALIDATE}, stale-while-revalidate=300`,
        },
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Horizons ephemeris fetch failed";
      const unresolved = e instanceof HorizonsResolveError;
      return NextResponse.json(
        {
          des,
          error: message,
          source: "JPL Horizons",
        },
        { status: unresolved ? 404 : 502 }
      );
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Horizons ephemeris fetch failed";
    return NextResponse.json(
      { error: message, source: "JPL Horizons" },
      { status: 502 }
    );
  }
}
