import { Badge } from "@/components/ui/badge";

/** 70+ is a strong match (default/filled badge); below that it still cleared MIN_MATCH_SCORE but is a softer match (secondary/muted badge). */
export function MatchScoreBadge({ score }: { score: number }) {
  return (
    <Badge variant={score >= 70 ? "default" : "secondary"}>{score}%</Badge>
  );
}
