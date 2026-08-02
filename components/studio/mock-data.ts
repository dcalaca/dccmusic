import type { Stem, StudioProject } from './types'

export const DEFAULT_MOCK_PROJECT_ID = 'mock-project'

export function createMockProject(projectId?: string): StudioProject {
  return {
    id: projectId || DEFAULT_MOCK_PROJECT_ID,
    title: 'Projeto de teste — DCC Studio',
    artist: 'DCC Music',
    coverUrl: null,
    audioUrl: null,
  }
}

/** Preview visual do DAW até a separação real carregar. */
export function createMockStems(): Stem[] {
  const names = [
    ['vocal', 'Vocals'],
    ['backing_vocals', 'Backing Vocals'],
    ['drums', 'Drums'],
    ['bass', 'Bass'],
    ['guitar', 'Guitar'],
    ['keyboard', 'Keyboard'],
    ['strings', 'Strings'],
    ['others', 'Others'],
  ] as const

  return names.map(([type, name], index) => ({
    id: `stem-${type}`,
    name,
    type,
    volume: type === 'vocal' ? 80 : 70,
    muted: false,
    solo: false,
    url: null,
    offsetSec: index % 3 === 0 ? 0 : index % 3 === 1 ? 2 : 4,
  }))
}
