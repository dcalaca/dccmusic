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

export function createMockStems(): Stem[] {
  return [
    {
      id: 'stem-vocal',
      name: 'Vocal',
      type: 'vocal',
      volume: 80,
      muted: false,
      solo: false,
      url: null,
    },
    {
      id: 'stem-drums',
      name: 'Drums',
      type: 'drums',
      volume: 75,
      muted: false,
      solo: false,
      url: null,
    },
    {
      id: 'stem-bass',
      name: 'Bass',
      type: 'bass',
      volume: 70,
      muted: false,
      solo: false,
      url: null,
    },
    {
      id: 'stem-others',
      name: 'Others',
      type: 'others',
      volume: 70,
      muted: false,
      solo: false,
      url: null,
    },
  ]
}
