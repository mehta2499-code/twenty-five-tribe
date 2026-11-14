/** One trivia question: [question, right answer, wrong, wrong, wrong]. */
export type Raw = [string, string, string, string, string];

/** A topic in the weekly trivia rotation. */
export type WeekPack = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  difficulty: 1 | 2 | 3;
  qs: Raw[];
};
