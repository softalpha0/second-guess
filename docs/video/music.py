# Original background music for the Second Guess demo (composed in code, no samples).
import numpy as np, wave, sys
SR = 44100
DUR = float(sys.argv[1]); OUT = sys.argv[2]
N = int(DUR * SR); t = np.arange(N) / SR
mix = np.zeros(N)
BPM = 84; BEAT = 60 / BPM; BAR = 4 * BEAT

def midi(n): return 440 * 2 ** ((n - 69) / 12)
def env_adsr(n, a, r):
    e = np.ones(n); ai = min(n, int(a * SR)); ri = min(n, int(r * SR))
    e[:ai] = np.linspace(0, 1, ai); e[n - ri:] *= np.linspace(1, 0, ri); return e
def add(sig, start):
    i = int(start * SR); j = min(N, i + len(sig))
    if i < N: mix[i:j] += sig[: j - i]
def smooth(x, k):  # cheap low-pass (moving average)
    return np.convolve(x, np.ones(k) / k, mode='same')

# chord progression (Am7, Fmaj7, C, G) — roots and voicings in MIDI
CHORDS = [(45, [57, 60, 64, 67]), (41, [57, 60, 64, 65]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]

# scene times (seconds) from the edit
SCENES = [0, 8.0, 25.53, 37.03, 44.03, 51.03, 64.67]
OUTRO = 64.67

bar = 0; start = 0.0
while start < DUR:
    root, voicing = CHORDS[bar % 4]
    n = int(BAR * SR) + int(0.6 * SR)
    tt = np.arange(n) / SR
    # pad: soft detuned partials
    pad = np.zeros(n)
    for m in voicing:
        f = midi(m)
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            pad += np.sin(2 * np.pi * ff * tt) + 0.25 * np.sin(2 * np.pi * 2 * ff * tt) + 0.08 * np.sin(2 * np.pi * 3 * ff * tt)
    pad *= env_adsr(n, 0.9, 1.1) * 0.022
    add(pad, start)
    # bass on beats 1 and 3 (from the intro on)
    if start >= 7.5:
        for b in (0, 2):
            bn = int(BEAT * 1.9 * SR); bt = np.arange(bn) / SR
            bass = np.sin(2 * np.pi * midi(root) * bt) * np.exp(-bt * 1.6) * env_adsr(bn, 0.02, 0.3) * 0.12
            add(bass, start + b * BEAT)
    # arpeggio (eighth notes) after the hook, softer in the outro
    if start >= 7.5:
        notes = voicing + [voicing[1] + 12, voicing[2] + 12, voicing[3] + 12, voicing[2] + 12]
        for k in range(8):
            when = start + k * BEAT / 2
            if when >= DUR: break
            pn = int(0.9 * SR); pt = np.arange(pn) / SR
            f = midi(notes[k % len(notes)] + 12)
            pluck = (np.sin(2 * np.pi * f * pt) + 0.3 * np.sin(2 * np.pi * 2 * f * pt)) * np.exp(-pt * 5.5)
            level = 0.035 if when < OUTRO else 0.022
            add(pluck * env_adsr(pn, 0.004, 0.05) * level, when)
    # soft kick + hat (scenes with the app), not in the hook or the last bars
    if 7.5 <= start < DUR - BAR * 1.5:
        for b in range(4):
            kn = int(0.35 * SR); kt = np.arange(kn) / SR
            f = 95 * np.exp(-kt * 18) + 45
            kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-kt * 9) * (0.16 if b in (0, 2) else 0.07)
            add(kick, start + b * BEAT)
            hn = int(0.06 * SR)
            hat = np.random.default_rng(bar * 10 + b).standard_normal(hn)
            hat = (hat - smooth(hat, 6)) * np.exp(-np.arange(hn) / SR * 60) * 0.018
            add(hat, start + b * BEAT + BEAT / 2)
    bar += 1; start += BAR

# chime when a "hesitated" verdict is on screen (hook at ~1.0 s, close-up at ~44.4 s)
def chime(at, base=76):
    for i, m in enumerate((base, base + 7, base + 12)):
        cn = int(2.2 * SR); ct = np.arange(cn) / SR
        f = midi(m)
        c = (np.sin(2 * np.pi * f * ct) + 0.2 * np.sin(2 * np.pi * 2.76 * f * ct)) * np.exp(-ct * 2.4) * 0.06
        add(c * env_adsr(cn, 0.005, 0.2), at + i * 0.09)
chime(1.0); chime(44.4)

# gentle swell into each scene change
for s in SCENES[1:]:
    sn = int(0.7 * SR)
    noise = np.random.default_rng(int(s * 100)).standard_normal(sn)
    noise = smooth(noise, 40)
    sw = noise * np.linspace(0, 1, sn) ** 2 * 0.25
    add(sw * env_adsr(sn, 0.01, 0.08), s - 0.6)

# master: fade in/out, normalise to -3 dBFS, stereo widen slightly via tiny delay
mix *= np.clip(t / 1.5, 0, 1) * np.clip((DUR - t) / 3.0, 0, 1)
mix /= np.max(np.abs(mix)) / 0.7
d = int(0.012 * SR)
left = mix; right = np.concatenate([np.zeros(d), mix[:-d]]) * 0.97 + mix * 0.03
st = np.stack([left, right], axis=1)
pcm = (np.clip(st, -1, 1) * 32767).astype('<i2')
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', OUT, f'{DUR:.1f}s')
