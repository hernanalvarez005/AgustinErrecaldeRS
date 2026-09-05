/** Converts free text into a URL/slug-safe, lowercase, hyphenated string. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (á -> a, ñ -> n, ...)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Short random suffix used to keep generated slugs unique on collision. */
export function randomSlugSuffix(length = 4): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length);
}
