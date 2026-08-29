export interface FuzzyResult {
  score: number
  indices: number[]
}

/**
 * Subsequence fuzzy match: every character of `query` must appear in `text`
 * in order (not necessarily contiguous). Consecutive matches score higher,
 * matching how quick-open tools like VS Code's Cmd+P rank results.
 */
export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  if (!query) return { score: 0, indices: [] }

  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const indices: number[] = []
  let qi = 0
  let score = 0
  let lastMatchIndex = -1

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += lastMatchIndex === ti - 1 ? 3 : 1
      lastMatchIndex = ti
      indices.push(ti)
      qi++
    }
  }

  return qi === q.length ? { score, indices } : null
}
