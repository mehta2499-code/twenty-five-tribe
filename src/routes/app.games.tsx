import { createFileRoute } from "@tanstack/react-router";
import { clientOnly } from "@/components/SocialUI";
import { GamesScreen } from "@/components/GamesScreen";

export const Route = createFileRoute("/app/games")({
  component: clientOnly(GamesHome),
});

/** Games home: the daily games and their leaderboards. */
function GamesHome() {
  return <GamesScreen mode="home" />;
}
