import fs from 'node:fs'
import path from 'node:path'

function patchFile(filePath, patches, label) {
  let source = fs.readFileSync(filePath, 'utf8')
  let changed = false

  for (const patch of patches) {
    if (source.includes(patch.marker)) continue
    if (!source.includes(patch.anchor)) {
      throw new Error(`[${label}] Não encontrei o trecho esperado para ${patch.marker}`)
    }
    source = source.replace(patch.anchor, patch.replacement)
    changed = true
  }

  if (changed) {
    fs.writeFileSync(filePath, source, 'utf8')
    console.log(`[${label}] Voz cadastrada habilitada na melhoria de música.`)
  }
}

const pagePath = path.join(process.cwd(), 'app/compositores/admin/studio-ia/melhorar/musica-pronta/page.tsx')
const apiPath = path.join(process.cwd(), 'app/api/compositores/studio/enhance/route.ts')

patchFile(pagePath, [
  {
    marker: '// custom-voice-enhance:state',
    anchor: "  const [savedOriginal, setSavedOriginal] = useState<any>(null)\n",
    replacement: "  const [savedOriginal, setSavedOriginal] = useState<any>(null)\n  // custom-voice-enhance:state\n  const [registeredVoices, setRegisteredVoices] = useState<any[]>([])\n  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState('')\n",
  },
  {
    marker: '// custom-voice-enhance:load',
    anchor: "  const isLanguageAdaptation = selectedImprovement === 'language_adaptation'\n",
    replacement: `  // custom-voice-enhance:load\n  useEffect(() => {\n    const token = localStorage.getItem('composer_token')\n    if (!token) return\n\n    fetch('/api/compositores/studio/voices', {\n      headers: { Authorization: \`Bearer \${token}\` },\n      cache: 'no-store',\n    })\n      .then((response) => response.json())\n      .then((data) => {\n        const readyVoices = (data.voices || []).filter((voice: any) =>\n          voice.status === 'ready' && voice.isAvailable && voice.voiceId\n        )\n        setRegisteredVoices(readyVoices)\n      })\n      .catch(() => setRegisteredVoices([]))\n  }, [])\n\n  const isLanguageAdaptation = selectedImprovement === 'language_adaptation'\n`,
  },
  {
    marker: '// custom-voice-enhance:payload',
    anchor: "          voiceStyle: selectedVoiceStyle,\n          voiceTone,\n",
    replacement: "          voiceStyle: selectedVoiceStyle,\n          // custom-voice-enhance:payload\n          voiceProfileId: selectedVoiceProfileId || null,\n          voiceTone,\n",
  },
  {
    marker: 'custom-voice-enhance:ui',
    anchor: "              <p className=\"mb-3 mt-5 text-sm font-bold text-gray-300\">Estilo da voz</p>\n",
    replacement: `              <div className="mt-5 rounded-2xl border border-purple-800/60 bg-purple-950/20 p-4" data-feature="custom-voice-enhance:ui">\n                <label>\n                  <span className="mb-1.5 block text-sm font-bold text-purple-100">Usar minha voz cadastrada <span className="font-normal text-gray-400">(opcional)</span></span>\n                  <select\n                    value={selectedVoiceProfileId}\n                    onChange={(event) => {\n                      const voiceId = event.target.value\n                      setSelectedVoiceProfileId(voiceId)\n                      if (voiceId) setSelectedVoice('same')\n                    }}\n                    className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500"\n                  >\n                    <option value="">Não usar voz cadastrada</option>\n                    {registeredVoices.map((voice) => (\n                      <option key={voice.id} value={voice.id}>{voice.displayName}</option>\n                    ))}\n                  </select>\n                  <span className="mt-2 block text-xs text-purple-100/75">\n                    Se escolher uma voz, a melhoria usa sua voz clonada junto com o gênero/ritmo selecionado acima.\n                  </span>\n                </label>\n              </div>\n\n              <p className="mb-3 mt-5 text-sm font-bold text-gray-300">Estilo da voz</p>\n`,
  },
], 'enhance-custom-voice-page')

patchFile(apiPath, [
  {
    marker: '// custom-voice-enhance:var',
    anchor: "    let voiceStyle = 'natural'\n    let voiceTone = 'Deixar a IA escolher'\n",
    replacement: "    let voiceStyle = 'natural'\n    // custom-voice-enhance:var\n    let voiceProfileId = ''\n    let voiceTone = 'Deixar a IA escolher'\n",
  },
  {
    marker: '// custom-voice-enhance:json',
    anchor: "      voiceStyle = String(body?.voiceStyle || 'natural')\n      voiceTone = String(body?.voiceTone || 'Deixar a IA escolher').trim().slice(0, 80)\n",
    replacement: "      voiceStyle = String(body?.voiceStyle || 'natural')\n      // custom-voice-enhance:json\n      voiceProfileId = String(body?.voiceProfileId || '').trim()\n      voiceTone = String(body?.voiceTone || 'Deixar a IA escolher').trim().slice(0, 80)\n",
  },
  {
    marker: '// custom-voice-enhance:form',
    anchor: "      voiceStyle = String(formData.get('voiceStyle') || 'natural')\n      voiceTone = String(formData.get('voiceTone') || 'Deixar a IA escolher').trim().slice(0, 80)\n",
    replacement: "      voiceStyle = String(formData.get('voiceStyle') || 'natural')\n      // custom-voice-enhance:form\n      voiceProfileId = String(formData.get('voiceProfileId') || '').trim()\n      voiceTone = String(formData.get('voiceTone') || 'Deixar a IA escolher').trim().slice(0, 80)\n",
  },
  {
    marker: '// custom-voice-enhance:resolve',
    anchor: "    const title = formatMusicTitle(rawTitle)\n    let lyricSource: 'manual' | 'whisper' | 'none' = lyric ? 'manual' : 'none'\n",
    replacement: `    // custom-voice-enhance:resolve\n    let selectedVoiceProfile: any = null\n    if (voiceProfileId) {\n      const { data: voiceProfile, error: voiceProfileError } = await supabaseAdmin\n        .from('studio_voice_profiles')\n        .select('id, display_name, voice_id, status, is_available')\n        .eq('id', voiceProfileId)\n        .eq('composer_id', composer.composerId)\n        .maybeSingle()\n\n      if (voiceProfileError) throw voiceProfileError\n      if (!voiceProfile || voiceProfile.status !== 'ready' || !voiceProfile.is_available || !voiceProfile.voice_id) {\n        return NextResponse.json({ error: 'A voz cadastrada escolhida não está disponível. Atualize a página e tente novamente.' }, { status: 400 })\n      }\n      selectedVoiceProfile = voiceProfile\n      voice = 'same'\n    }\n\n    const title = formatMusicTitle(rawTitle)\n    let lyricSource: 'manual' | 'whisper' | 'none' = lyric ? 'manual' : 'none'\n`,
  },
  {
    marker: '// custom-voice-enhance:require-lyrics',
    anchor: "    const slug = await createUniqueProjectSlug(composer.composerId, title)\n",
    replacement: `    // custom-voice-enhance:require-lyrics\n    if (selectedVoiceProfile && !lyric) {\n      return NextResponse.json(\n        { error: 'Para usar sua voz cadastrada na melhoria, precisamos da letra. Clique em “Entender letra” ou cole a letra e tente novamente.' },\n        { status: 400 }\n      )\n    }\n\n    const slug = await createUniqueProjectSlug(composer.composerId, title)\n`,
  },
  {
    marker: '// custom-voice-enhance:description',
    anchor: "          `Preferência de voz: ${getVoicePrompt(voice)}.`,\n          `Estilo vocal: ${getVoiceStylePrompt(voiceStyle)}.`,\n",
    replacement: "          `Preferência de voz: ${getVoicePrompt(voice)}.`,\n          // custom-voice-enhance:description\n          selectedVoiceProfile ? `Voz cadastrada: ${selectedVoiceProfile.display_name}.` : null,\n          `Estilo vocal: ${getVoiceStylePrompt(voiceStyle)}.`,\n",
  },
  {
    marker: '// custom-voice-enhance:weights',
    anchor: "    const explicitVoiceChange = voice === 'male' || voice === 'female'\n    const audioWeight = explicitVoiceChange ? 0.72 : 0.85\n",
    replacement: "    // custom-voice-enhance:weights\n    const explicitVoiceChange = Boolean(selectedVoiceProfile) || voice === 'male' || voice === 'female'\n    const audioWeight = explicitVoiceChange ? 0.72 : 0.85\n",
  },
  {
    marker: '// custom-voice-enhance:persona',
    anchor: "      title,\n      model: 'V5_5',\n      callBackUrl: getStudioCallbackUrl('/api/studio/suno/callback'),\n",
    replacement: "      title,\n      // custom-voice-enhance:persona\n      ...(selectedVoiceProfile ? { personaId: selectedVoiceProfile.voice_id, personaModel: 'voice_persona' } : {}),\n      model: selectedVoiceProfile ? 'V5' : 'V5_5',\n      callBackUrl: getStudioCallbackUrl('/api/studio/suno/callback'),\n",
  },
  {
    marker: '// custom-voice-enhance:request-metadata',
    anchor: "          voice,\n          voiceStyle,\n          voiceTone,\n",
    replacement: "          voice,\n          voiceStyle,\n          // custom-voice-enhance:request-metadata\n          voiceProfileId: selectedVoiceProfile?.id || null,\n          customVoiceName: selectedVoiceProfile?.display_name || null,\n          customVoiceId: selectedVoiceProfile?.voice_id || null,\n          voiceTone,\n",
  },
], 'enhance-custom-voice-api')
