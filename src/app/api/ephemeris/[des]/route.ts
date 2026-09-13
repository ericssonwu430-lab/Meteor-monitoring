import { NextResponse } from "next/server";
import {
  HORIZONS_REVALIDATE,
  HorizonsResolveError,
  fetchHorizonsObserver,
} from "@/lib/horizons";

export const revalidate = 90;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ des: string }> }
) {
  try {
    const { des: raw } = await ctx.params;
    const des = decodeURIComponent(raw);
    const url = new URL(req.url);
    const bust =
      url.searchParams.has("_") ||
      url.searchParams.has("t") ||
      url.searchParams.get("live") === "1";

    try {
      const ephemeris = await fetchHorizonsObserver(des, new Date(), {
        bustCache: bust,
      });
      return NextResponse.json(ephemeris, {
        headers: {
          "Cache-Control": bust
            ? "no-store"
            : `public, s-maxage=${HORIZONS_REVALIDATE}, stale-while-revalidate=30`,
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
