'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioTrim, Stem } from './types'

type EngineState = {
  playing: boolean
  currentTime: number
  duration: number
  ready: boolean
  loading: boolean
  error: string | null
}

function effectiveGain(stem: Stem, stems: Stem[], masterVolume: number) {
  const anySolo = stems.some((item) => item.solo)
  if (stem.muted) return 0
  if (anySolo && !stem.solo) return 0
  return (Math.max(0, Math.min(100, stem.volume)) / 100) * (Math.max(0, Math.min(100, masterVolume)) / 100)
}

export function useStemEngine(input: {
  stems: Stem[]
  masterVolume: number
  trim: AudioTrim
  /** Token do compositor — necessário para baixar stems via proxy same-origin */
  authToken?: string | null
  onDuration?: (duration: number) => void
}) {
  const contextRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map())
  const gainsRef = useRef<Map<string, GainNode>>(new Map())
  const sourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map())
  const startedAtRef = useRef(0)
  const offsetAtStartRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const stemsRef = useRef(input.stems)
  const masterRef = useRef(input.masterVolume)
  const trimRef = useRef(input.trim)

  const [state, setState] = useState<EngineState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    ready: false,
    loading: false,
    error: null,
  })

  stemsRef.current = input.stems
  masterRef.current = input.masterVolume
  trimRef.current = input.trim

  const stopRaf = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const stopSources = useCallback(() => {
    for (const source of sourcesRef.current.values()) {
      try {
        source.stop()
      } catch {
        // already stopped
      }
      try {
        source.disconnect()
      } catch {
        // ignore
      }
    }
    sourcesRef.current.clear()
  }, [])

  const applyGains = useCallback(() => {
    const stems = stemsRef.current
    const master = masterRef.current
    for (const stem of stems) {
      const gain = gainsRef.current.get(stem.id)
      if (!gain) continue
      gain.gain.value = effectiveGain(stem, stems, master)
    }
  }, [])

  useEffect(() => {
    applyGains()
  }, [input.stems, input.masterVolume, applyGains])

  const ensureContext = useCallback(async () => {
    if (!contextRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      contextRef.current = new Ctx()
    }
    if (contextRef.current.state === 'suspended') {
      await contextRef.current.resume()
    }
    return contextRef.current
  }, [])

  const loadBuffers = useCallback(async () => {
    const playable = input.stems.filter((stem) => stem.url)
    if (playable.length === 0) {
      setState((prev) => ({
        ...prev,
        ready: false,
        loading: false,
        duration: 0,
        error: null,
      }))
      buffersRef.current.clear()
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))
    const ctx = await ensureContext()
    const nextBuffers = new Map<string, AudioBuffer>()
    let maxDuration = 0

    await Promise.all(
      playable.map(async (stem) => {
        try {
          const headers: HeadersInit = {}
          if (input.authToken && stem.url?.startsWith('/')) {
            headers.Authorization = `Bearer ${input.authToken}`
          }
          const response = await fetch(stem.url!, { headers, cache: 'no-store' })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const arrayBuffer = await response.arrayBuffer()
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
          nextBuffers.set(stem.id, audioBuffer)
          maxDuration = Math.max(maxDuration, audioBuffer.duration)
        } catch (error) {
          console.error('[Studio] falha ao carregar stem', stem.name, error)
        }
      })
    )

    buffersRef.current = nextBuffers
    for (const stem of playable) {
      if (!gainsRef.current.has(stem.id)) {
        const gain = ctx.createGain()
        gain.connect(ctx.destination)
        gainsRef.current.set(stem.id, gain)
      }
    }

    setState((prev) => ({
      ...prev,
      ready: nextBuffers.size > 0,
      loading: false,
      duration: maxDuration,
      error: nextBuffers.size === 0 ? 'Não foi possível carregar os stems para tocar.' : null,
    }))
    if (maxDuration > 0) input.onDuration?.(maxDuration)
  }, [ensureContext, input.authToken, input.stems, input.onDuration])

  useEffect(() => {
    loadBuffers()
    return () => {
      stopRaf()
      stopSources()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.authToken, input.stems.map((stem) => `${stem.id}:${stem.url || ''}`).join('|')])

  const tick = useCallback(() => {
    const ctx = contextRef.current
    if (!ctx) return
    const trim = trimRef.current
    const duration = state.duration
    const trimEnd = trim.endSec == null ? duration : Math.min(trim.endSec, duration || trim.endSec)
    const elapsed = offsetAtStartRef.current + (ctx.currentTime - startedAtRef.current)
    const absolute = elapsed

    if (trimEnd > trim.startSec && absolute >= trimEnd - 0.02) {
      stopSources()
      stopRaf()
      setState((prev) => ({
        ...prev,
        playing: false,
        currentTime: trim.startSec,
      }))
      return
    }

    setState((prev) => ({ ...prev, currentTime: absolute }))
    rafRef.current = requestAnimationFrame(tick)
  }, [state.duration, stopSources])

  const play = useCallback(async (fromTime?: number) => {
    const ctx = await ensureContext()
    const buffers = buffersRef.current
    if (buffers.size === 0) {
      await loadBuffers()
    }
    if (buffersRef.current.size === 0) return

    stopSources()
    const trim = trimRef.current
    const duration = Math.max(
      ...Array.from(buffersRef.current.values()).map((buffer) => buffer.duration),
      0
    )
    const trimEnd = trim.endSec == null ? duration : Math.min(trim.endSec, duration || trim.endSec)
    const startAt = Math.max(
      trim.startSec,
      Math.min(fromTime ?? state.currentTime, Math.max(trim.startSec, trimEnd - 0.05))
    )

    applyGains()
    startedAtRef.current = ctx.currentTime
    offsetAtStartRef.current = startAt

    for (const [stemId, buffer] of buffersRef.current.entries()) {
      const gain = gainsRef.current.get(stemId)
      if (!gain) continue
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(gain)
      const offset = Math.min(startAt, Math.max(0, buffer.duration - 0.01))
      const playDuration =
        trimEnd > startAt ? Math.max(0.01, Math.min(buffer.duration - offset, trimEnd - startAt)) : undefined
      source.start(0, offset, playDuration)
      sourcesRef.current.set(stemId, source)
    }

    setState((prev) => ({
      ...prev,
      playing: true,
      currentTime: startAt,
      duration,
      ready: true,
    }))
    stopRaf()
    rafRef.current = requestAnimationFrame(tick)
  }, [applyGains, ensureContext, loadBuffers, state.currentTime, stopSources, tick])

  const pause = useCallback(() => {
    const ctx = contextRef.current
    if (ctx && state.playing) {
      const elapsed = offsetAtStartRef.current + (ctx.currentTime - startedAtRef.current)
      setState((prev) => ({ ...prev, playing: false, currentTime: elapsed }))
    } else {
      setState((prev) => ({ ...prev, playing: false }))
    }
    stopSources()
    stopRaf()
  }, [state.playing, stopSources])

  const seek = useCallback((time: number) => {
    const trim = trimRef.current
    const duration = state.duration
    const trimEnd = trim.endSec == null ? duration : Math.min(trim.endSec, duration || trim.endSec)
    const next = Math.max(trim.startSec, Math.min(time, trimEnd || duration || time))
    const wasPlaying = state.playing
    stopSources()
    stopRaf()
    setState((prev) => ({ ...prev, currentTime: next, playing: false }))
    if (wasPlaying) {
      void play(next)
    }
  }, [play, state.duration, state.playing, stopSources])

  const getPeaks = useCallback((stemId: string, bars = 80) => {
    const buffer = buffersRef.current.get(stemId)
    if (!buffer) {
      // fallback visual estável
      return Array.from({ length: bars }, (_, i) => 0.2 + ((i * 17 + stemId.length * 3) % 50) / 100)
    }
    const channel = buffer.getChannelData(0)
    const block = Math.floor(channel.length / bars) || 1
    const peaks: number[] = []
    for (let i = 0; i < bars; i += 1) {
      let max = 0
      const start = i * block
      for (let j = 0; j < block; j += 1) {
        const value = Math.abs(channel[start + j] || 0)
        if (value > max) max = value
      }
      peaks.push(Math.min(1, max * 1.6))
    }
    return peaks
  }, [])

  return {
    ...state,
    play,
    pause,
    seek,
    getPeaks,
    reload: loadBuffers,
  }
}
