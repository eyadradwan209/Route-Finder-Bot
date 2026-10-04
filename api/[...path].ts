export default function handler() {
  return new Response(
    JSON.stringify({ status: "ok", service: "route-finder-bot" }),
    { headers: { "content-type": "application/json" } },
  );
}
