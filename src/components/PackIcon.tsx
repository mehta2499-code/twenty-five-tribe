import {
  Atom,
  BookOpen,
  Car,
  Clapperboard,
  Coins,
  Cpu,
  Disc3,
  Dribbble,
  Film,
  Flag,
  Gamepad2,
  Globe2,
  HeartPulse,
  HelpCircle,
  Landmark,
  Map,
  Medal,
  Mic,
  Music,
  PawPrint,
  Plane,
  Popcorn,
  Rocket,
  Shield,
  Smile,
  Sofa,
  Sparkles,
  Star,
  Tag,
  Trophy,
  Tv,
  UtensilsCrossed,
  Wifi,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  // The classics
  ipl: Trophy,
  bolly00s: Clapperboard,
  indiagk: Map,
  hindimusic: Music,
  desilife: Smile,
  // Weekly topics
  worldcups: Trophy,
  bolly10s: Clapperboard,
  desifood: UtensilsCrossed,
  spaceisro: Rocket,
  indiatv: Tv,
  football: Dribbble,
  mythology: Sparkles,
  worldgeo: Globe2,
  bolly90s: Film,
  techstart: Cpu,
  olympics: Medal,
  modernindia: Flag,
  hollywood: Popcorn,
  engpop: Disc3,
  brands: Tag,
  racquets: Medal,
  festivals: Sparkles,
  humanbody: HeartPulse,
  bollysongs: Mic,
  videogames: Gamepad2,
  indsports: Trophy,
  famousindians: Star,
  animals: PawPrint,
  marveldc: Shield,
  indcities: Landmark,
  f1: Car,
  ancientindia: Landmark,
  capitals: Flag,
  anime: Tv,
  money: Coins,
  cricketrecords: Trophy,
  books: BookOpen,
  science: Atom,
  sitcoms: Sofa,
  travelindia: Plane,
  sportsmix: Medal,
  wonders: Globe2,
  worldfood: UtensilsCrossed,
  bollyclassics: Film,
  internet: Wifi,
};

/** Icon for a trivia pack, in a soft tile. */
export function PackIcon({ id, size = 40 }: { id: string; size?: number }) {
  const Icon = ICONS[id] ?? HelpCircle;
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl shrink-0"
      style={{ width: size, height: size, background: "var(--fill)", color: "var(--blue-deep)" }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}
