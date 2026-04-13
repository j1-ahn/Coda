'use client';

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Prompt recipes
// ---------------------------------------------------------------------------

type Style  = 'animation' | 'cinematic';
type Genre  = 'hyper' | 'hiphop' | 'electronic' | 'house' | 'kpop' | 'pop' | 'jpop' | 'folk' | 'lofi' | 'bgm' | 'rock' | 'ukg';

const GENRES: { id: Genre; label: string }[] = [
  { id: 'hyper',      label: 'Hyper'      },
  { id: 'hiphop',     label: 'Hiphop'     },
  { id: 'electronic', label: 'Electronic' },
  { id: 'house',      label: 'House'      },
  { id: 'kpop',       label: 'Kpop'       },
  { id: 'pop',        label: 'Pop'        },
  { id: 'jpop',       label: 'Jpop'       },
  { id: 'folk',       label: 'Folk'       },
  { id: 'lofi',       label: 'Lofi'       },
  { id: 'bgm',        label: 'BGM'        },
  { id: 'rock',       label: 'Rock'       },
  { id: 'ukg',        label: 'UKG'        },
];

const PROMPTS: Record<Style, Record<Genre, string>> = {
  animation: {
    hyper:      'Hyperkinetic anime action sequence. Extreme speed lines, blazing neon particle bursts, chromatic aberration on fast motion. High-saturation palette — electric cyan, hot magenta, searing yellow. Frame-rate stutter cuts, impact freeze frames. Intense, breathless, unstoppable.',
    hiphop:     'Urban anime aesthetic. Graffiti-tagged brick backdrop softly animated with rising steam and subway flicker. Characters in silhouette, boom-bap beat-driven bounce. Warm amber streetlight, deep shadow, hand-drawn ink lines. Gold chain glint particles.',
    electronic: 'Digital wireframe landscape morphing in sync with pulse. Tron-grid environment with oscilloscope waveforms weaving through geometry. Cold blue-to-violet gradient, hard data-light artifacts, pixel-glitch dissolves, looping sine-wave motion.',
    house:      'Deep-house vinyl loop. Spinning record close-up, warm dusk palette — burnt amber, coral, dusty rose. Slow breathing camera, analog grain overlay, gentle lens flare sweep. DJ booth silhouette against gradient horizon. Smooth, hypnotic, warm.',
    kpop:       'Idol-stage animation burst. Iridescent confetti cascade, holographic lens flares, mirrored stage tiles. Pastel prismatic gradient background cycling pink → mint → lavender. Synchronized sparkle particles on beat. Glossy, aspirational, euphoric.',
    pop:        'Bubbly cartoon pop frame. Bold outlines, flat vivid fills, exaggerated bounce physics. Color palette: sunshine yellow, bubble-gum pink, sky blue. Stars and hearts burst outward on beat. Fun, immediate, irresistibly catchy energy.',
    jpop:       'Soft Harajuku aesthetic. Cherry blossom petals drift across pastel watercolor sky. Cute character silhouette with sparkle halo. Warm white bloom, delicate ink-line details. Kawaii gentle motion — petals, ribbons, soft lens bokeh.',
    folk:       'Hand-drawn illustration loop. Loose pencil lines, warm sepia and muted earth tones. Acoustic guitar silhouette against rolling hills. Floating dust motes, vintage paper grain, gentle parallax depth. Intimate, honest, quietly alive.',
    lofi:       'Lo-fi anime study room. Warm desk lamp glow, rain trickling down window, vinyl crackling on player. Vintage film grain, soft VHS bloom, color temperature shift amber. Cat asleep on windowsill. Endlessly cozy, meditative, nostalgic.',
    bgm:        'Ambient nature animation loop. Soft golden light through forest canopy, leaves stirring, mist over still water. Minimal motion, watercolor wash, gentle chromatic haze. Peaceful, expansive, weightless — pure background presence.',
    rock:       'Concert stage animation. Blinding spotlight cones, electric guitar silhouette frozen in power pose. High-contrast white on black, raw grain texture, distortion ripple on beat. Smoke machine haze, crowd silhouette surge. Raw, loud, alive.',
    ukg:        'UK garage underground atmosphere. Strobe flicker on dark club interior, bass-pulse waveform cutting the floor. Urban night-city backdrop, wet pavement reflections, cold blue-neon accent. Tight, dark, rhythmically charged.',
  },
  cinematic: {
    hyper:      'Hyper-real action cinematography. Extreme slow-motion bullet-time freeze, depth-of-field rack focus, anamorphic lens streak. Desaturated steel-blue grade with blown highlights. Handheld shutter stutter on impact. Visceral, physical, cinema-quality tension.',
    hiphop:     'Golden-hour street cinema. 35mm film grain, warm honey grade, shallow focus on textured concrete. Slow drift reveal shot, smoke-curl foreground. Lens flare from low sun. Documentary authenticity — real, grounded, culturally resonant.',
    electronic: 'Cyberpunk establishing shot. Rain-slicked megacity at 3 AM, neon signage reflecting in puddles. Ultra-wide anamorphic, deep focus, chromatic aberration on distant lights. Teal-and-orange grade, volume fog, oppressive verticality.',
    house:      'Mediterranean sunset filmic grade. Golden dusk through eucalyptus, long lens compression, bokeh heat shimmer. Slow dolly in on horizon. 16mm organic grain, soft halation, Kodak warmth. Languid, sensual, timeless.',
    kpop:       'High-key idol film aesthetic. Softbox-lit close-up, creamy skin tone, subtle lens bloom. Desaturated background makes subject glow. Slow-motion hair and fabric motion, confetti caught in light shaft. Polished, aspirational, idol-screen perfect.',
    pop:        'Bright music-video cinematography. High-key studio light, vivid saturated wardrobe, sharp focus. Quick editorial cuts, crash-zoom on beat, wide-angle lens distortion. Commercial gloss finish. Energetic, joyful, instantly memorable.',
    jpop:       'Sakura soft cinema. Early spring overcast light, diffused white sky, petals in slow descent. Delicate pastel grade — blush, ivory, celadon. Long lens bokeh isolates subject from flowing branches. Tender, quiet, fleeting beauty.',
    folk:       'Naturalistic indie film. Magic-hour backlight through tall grass, grain and halation on faces. Handheld gentle drift, shallow depth, sun flare. Desaturated forest greens, warm skin tones. Honest, unhurried, emotionally close.',
    lofi:       'Quiet-life short film. Interior window light, soft overcast fill, 16mm grain on every frame. Muted analog palette — faded teal, warm beige, dusty ivory. Still camera, small domestic details in focus. Intimate, reflective, deeply personal.',
    bgm:        'Landscape cinematic sweep. Drone aerial over misty valley, first light cresting ridge line. Anamorphic ultra-wide, rich atmospheric depth. Cool shadow to warm highlight grade. Epic scale, silent emotion, orchestral grandeur in stillness.',
    rock:       'Live-concert documentary cinematography. Handheld push through crowd, stage backlight silhouette, smoke-filled air. High-contrast B&W toning, motion blur on guitar neck. Grain pushed hard. Raw energy, visceral presence, legendary feeling.',
    ukg:        'Late-night club film noir. Available light only — neon bar signs, face half in shadow. 35mm pushed-process grain, high contrast, cool blue-to-amber split tone. Tight frames, claustrophobic intimacy. Dark, stylish, underground credibility.',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PromptCookbook() {
  const [style, setStyle] = useState<Style | null>(null);
  const [genre, setGenre] = useState<Genre | null>(null);
  const [copied, setCopied] = useState(false);

  const prompt = style && genre ? PROMPTS[style][genre] : null;

  const handleCopy = () => {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="px-3 py-2.5 flex flex-col gap-2.5">

      {/* Style picker */}
      <div className="grid grid-cols-2 gap-1">
        {(['animation', 'cinematic'] as Style[]).map((s) => (
          <button
            key={s}
            onClick={() => setStyle(style === s ? null : s)}
            className={`py-1 text-[10px] font-semibold tracking-widest uppercase border transition-colors ${
              style === s
                ? 'bg-ink-900 text-cream-100 border-ink-900'
                : 'border-cream-300 text-ink-500 hover:text-ink-900 hover:border-ink-500'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Genre grid */}
      <div className="grid grid-cols-4 gap-0.5">
        {GENRES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setGenre(genre === id ? null : id)}
            className={`py-1 text-[9px] font-semibold tracking-wider uppercase border transition-colors ${
              genre === id
                ? 'bg-ink-900 text-cream-100 border-ink-900'
                : 'border-cream-300 text-ink-400 hover:text-ink-900 hover:border-ink-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Generated prompt */}
      {prompt && (
        <div className="flex flex-col gap-1.5">
          <textarea
            readOnly
            value={prompt}
            rows={5}
            className="w-full text-[10px] text-ink-600 bg-cream-200 border border-cream-300 px-2.5 py-2 resize-none leading-relaxed font-sans focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className={`self-end text-[9px] label-caps px-2.5 py-1 border transition-colors ${
              copied
                ? 'bg-ink-900 text-cream-100 border-ink-900'
                : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
            }`}
          >
            {copied ? 'COPIED ✓' : 'COPY'}
          </button>
        </div>
      )}

    </div>
  );
}
