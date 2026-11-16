import { createFileRoute } from "@tanstack/react-router";
import { clientOnly } from "@/components/SocialUI";
import { GamesScreen } from "@/components/GamesScreen";

export const Route = createFileRoute("/app/arcade")({
  component: clientOnly(MoreGames),
});

/** Live games with your 25 that don't count towards the leaderboard. */
function MoreGames() {
  return <GamesScreen mode="more" />;
}
