import { NextResponse } from "next/server";
import { oceanRegion } from "@/lib/fireballLocation";
import { resolveLocation } from "@/lib/geocode";

export const revalidate = 86400;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message, country: null, location: null },
    { status }
  );
}

/** Reverse-geocode asteroid/fireball coordinates only — never visitor IP/location. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return jsonError("lat and lon required", 400);
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return jsonError("lat/lon out of range", 400);
  }

  const { country, location, cached } = await resolveLocation(lat, lon);

  return NextResponse.json({
    country,
    location: location || oceanRegion(lat, lon),
    lat,
    lon,
    cached,
  });
}
