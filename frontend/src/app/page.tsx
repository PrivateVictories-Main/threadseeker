import { HomeApp } from "./home-app";

// The home route is a thin server wrapper: the whole app lives in
// home-app.tsx (shared with the /search/[slug] SEO landings, which mount it
// pre-seeded with their query). Keeping the page file prop-less satisfies
// Next's PageProps typegen for the route.
export default function Page() {
  return <HomeApp />;
}
