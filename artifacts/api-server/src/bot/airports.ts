const featuredAirports = new Set<string>();

export function addAirport(code: string): boolean {
  const upper = code.toUpperCase().trim();
  if (featuredAirports.has(upper)) return false;
  featuredAirports.add(upper);
  return true;
}

export function removeAirport(code: string): boolean {
  const upper = code.toUpperCase().trim();
  return featuredAirports.delete(upper);
}

export function listAirports(): string[] {
  return Array.from(featuredAirports).sort();
}

export function hasAirport(code: string): boolean {
  return featuredAirports.has(code.toUpperCase().trim());
}
