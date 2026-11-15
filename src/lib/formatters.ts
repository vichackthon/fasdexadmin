export function formatDateOfBirth(value: string | null | undefined, fallback = 'N/A'): string {
    const trimmed = value?.trim()
    if (!trimmed) return fallback

    if (
        trimmed.includes('picked.day') ||
        trimmed.includes('${picked.') ||
        trimmed.includes('\\${picked.')
    ) {
        return fallback
    }

    const displayFormatMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (displayFormatMatch) {
        return trimmed
    }

    const isoFormatMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/)
    if (isoFormatMatch) {
        const [, year, month, day] = isoFormatMatch
        return `${day}/${month}/${year}`
    }

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-GB')
    }

    return fallback
}
