export function extractLanguage(className?: string): string | undefined {
  const match = /language-(\w+)/.exec(className ?? '')
  return match?.[1]
}
