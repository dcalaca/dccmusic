import { describe, expect, it } from 'vitest'
import { isSambaCancao, getStudioGenreDirection, getStudioGenreNegativeTags } from './studio-genre-direction'

describe('samba-canção generation direction', () => {
  it.each(['Samba Canção', 'Samba canção', 'samba-cancao', 'Samba-canção romântico'])('recognizes %s', (style) => {
    expect(isSambaCancao(style)).toBe(true)
    expect(getStudioGenreDirection(style)).toContain('slow relaxed tempo')
    expect(getStudioGenreNegativeTags(style)).toContain('carnival samba')
  })
  it.each(['Samba', 'Samba enredo', 'Samba-Rap', 'Pagode', null])('preserves other genres: %s', (style) => {
    expect(isSambaCancao(style)).toBe(false)
    expect(getStudioGenreDirection(style)).toBe(style || '')
    expect(getStudioGenreNegativeTags(style)).toEqual([])
  })
  it('preserves details supplied alongside the genre', () => {
    expect(getStudioGenreDirection('Samba Canção com piano')).toContain('Samba Canção com piano')
  })
})
