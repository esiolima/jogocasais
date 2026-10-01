"""Original ConectAi score. Rebuild: Python + numpy + imageio-ffmpeg (authoring only).
No samples, external composition service, runtime dependencies, or borrowed melodies.
Three 48-bar arrangements: A / A' / B / A'' / bridge / outro. Stereo 44.1 kHz.
"""
from pathlib import Path
import json, math, subprocess, tempfile, wave
import numpy as np
import imageio_ffmpeg

SR = 44100
OUT = Path(__file__).resolve().parents[1] / 'public/assets/music'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(20261001)

def timbre(midi, length, instrument):
    t = np.arange(int((length + .4) * SR), dtype=np.float64) / SR
    f = 440 * 2 ** ((midi - 69) / 12)
    y = np.zeros(len(t))
    if instrument == 'marimba':
        for ratio, amp, decay in [(1,1,1.7),(4,.25,5.5),(10,.065,11)]:
            y += amp * np.sin(2*np.pi*f*ratio*t) * np.exp(-t*decay)
        y *= (1-np.exp(-t*220))
    elif instrument == 'felt':
        for k in range(1,9):
            y += (1/k**1.8)*np.cos(2*np.pi*f*k*(1+.00004*k*k)*t)*np.exp(-t*(1.15+k*.38))
        y *= (1-np.exp(-t*170))
    elif instrument == 'guitar':
        for k in range(1,13):
            y += np.sin(k*.34*np.pi)/k**1.35 * np.sin(2*np.pi*f*k*t+.15*k)*np.exp(-t*(1.4+k*.65))
        y *= (1-np.exp(-t*300))
    elif instrument == 'bass':
        y = (np.sin(2*np.pi*f*t)+.3*np.sin(4*np.pi*f*t)+.08*np.sin(6*np.pi*f*t))*np.exp(-t*2.4)
        y *= (1-np.exp(-t*120))
    elif instrument == 'pad':
        y = (.5*np.sin(2*np.pi*f*.999*t)+.5*np.sin(2*np.pi*f*1.001*t)+.1*np.sin(4*np.pi*f*t))
        y *= (1-np.exp(-t*3))*.6
    elif instrument == 'bell':
        y = (np.sin(2*np.pi*f*t)+.16*np.sin(2*np.pi*f*2.001*t)*np.exp(-t*5))*np.exp(-t*2)
        y *= 1-np.exp(-t*200)
    release = np.minimum(1,np.maximum(0,(length+.35-t)/.35))
    y *= release
    return y.astype(np.float32)

def render(slug, bpm, style, key):
    beat = 60/bpm
    duration = 48*4*beat
    mix = np.zeros((int((duration+4)*SR),2),np.float32)
    cache = {}
    def add(midi, at, length, level, inst, pan=0):
        if midi is None: return
        spec=(midi,round(length,3),inst)
        if spec not in cache: cache[spec]=timbre(midi,length,inst)
        v=cache[spec]; i=max(0,round(at*SR)); end=min(i+len(v),len(mix))
        stereo=np.array([math.cos((pan+1)*math.pi/4),math.sin((pan+1)*math.pi/4)])
        mix[i:end] += v[:end-i,None] * stereo[None,:] * level
    # Major 6/9, minor 7 and dominant 9 voicings, with inversions for close movement.
    progression = [(0,[0,4,7,11]),(9,[-3,0,4,7]),(2,[2,5,9,12]),(7,[-1,2,5,9]),
                   (4,[0,4,7,11]),(9,[-3,0,4,7]),(5,[0,5,9,12]),(7,[-1,2,5,9])]
    # Independent motifs with rests and varied phrase lengths, not a scale arpeggio loop.
    phrases = [
      [(0,7,.7), (1,9,.35),(1.5,7,.45),(2.5,4,1.1)],
      [(.5,4,.5),(1.5,2,.45),(2,0,1.3)],
      [(0,5,.8),(1.5,9,.4),(2,12,.5),(3,9,.65)],
      [(.5,7,.8),(2,2,.45),(2.75,4,.4),(3.5,2,.35)],
      [(0,4,1.2),(1.5,7,.55),(2.5,11,1.2)],
      [(.5,12,.55),(1.5,11,.45),(2.5,7,.55)],
      [(0,9,.7),(1,7,.5),(2,5,.8),(3.25,4,.4)],
      [(0,2,1.2),(2,7,.45),(3,0,.75)]
    ]
    bridge = [[(0,12,1.4),(2,9,1)],[(.5,7,.7),(2,4,1.4)],[(0,14,.7),(1,12,.7),(2.5,9,1)],[(.5,11,1.2),(2.5,7,1)]]
    swing = .09 if style=='swing' else .025
    drums={}
    for kind,dur in [('shaker',.085),('brush',.18),('kick',.19),('rim',.065)]:
        t=np.arange(int(SR*dur))/SR
        noise=rng.uniform(-1,1,len(t))
        if kind=='shaker': signal=(noise-np.roll(noise,1))*np.exp(-t*55)*.15
        elif kind=='brush': signal=np.convolve(noise,np.ones(5)/5,mode='same')*np.exp(-t*20)*.18
        elif kind=='kick': signal=np.sin(2*np.pi*(54*t+1.8*(1-np.exp(-t*30))))*np.exp(-t*28)*.28
        else: signal=(np.sin(2*np.pi*970*t)+.4*noise)*np.exp(-t*105)*.1
        drums[kind]=signal.astype(np.float32)
    def drum(kind, at, level=1,pan=0):
        v=drums[kind]*level;i=int(at*SR)
        mix[i:i+len(v)] += v[:,None]*np.array([.7-pan*.3,.7+pan*.3])[None,:]
    lead={'bossa':'guitar','swing':'marimba','dream':'felt'}[style]
    for bar in range(48):
        root, chord = progression[bar%8]
        at=bar*4*beat
        section=bar//8
        energy=[.72,.88,1,.86,.65,.87][section]
        # Sparse intro, musical break, and an outro that resolves before the loop.
        backing='felt' if style=='swing' else 'guitar'
        rhythm=[0,1.5,2.5] if style=='bossa' else [0,2] if style=='dream' else [.5,2.5]
        for pulse in rhythm:
            for j,n in enumerate(chord):
                add(60+key+n,at+(pulse+j*.022)*beat,1.1*beat,.042*energy,backing,-.38)
        for pulse,n in [(0,36+key+root),(2,43+key+root)]:
            if n>51:n-=12
            add(n,at+pulse*beat,1.4*beat,.15*energy,'bass',-.04)
        if style=='dream' or section==4:
            for n in chord[:3]:add(60+key+n,at,3.4*beat,.013,'pad',.3)
        if section!=4:
            for k in range(8):
                drum('shaker',at+(k*.5+(swing if k%2 else 0))*beat,(.28 if k%2 else .45)*energy,.6)
            for pulse in [1,3]:drum('brush' if style!='bossa' else 'rim',at+pulse*beat,.62*energy,-.35)
            if style!='dream':
                for pulse in [0,2.5]:drum('kick',at+pulse*beat,.6*energy)
        melody=bridge[bar%4] if section==4 else phrases[bar%8]
        if bar%8==7:melody=melody[:2] # leave space between phrases
        if bar==47:melody=[(0,0,2.1)]
        for pulse,n,length in melody:
            offset=12 if section==2 and bar%2 else 0
            pitch=72+key+n+offset
            if style=='dream':pitch-=12
            if style=='swing' and pulse%1==.5:pulse+=swing
            add(pitch,at+pulse*beat,length*beat,.11*energy,lead,.18)
            if section==2 and style!='dream':add(pitch-12,at+pulse*beat,length*beat,.025,'bell',.4)
        # A quiet answering figure only at phrase endings.
        if section in [1,3,5] and bar%4==3 and bar!=47:
            for j,n in enumerate([chord[2],chord[1]]):add(72+key+n,at+(2.75+j*.5)*beat,.7*beat,.035,'bell',-.25)
    # Short stereo room: staggered, damped reflections; no costly runtime convolution.
    dry=mix.copy()
    for delay,level in [(.037,.13),(.061,.10),(.103,.08),(.157,.06),(.227,.045),(.313,.025)]:
        shift=int(delay*SR)
        mix[shift:,0]+=dry[:-shift,1]*level
        mix[shift:,1]+=dry[:-shift,0]*level
    mix=mix[:int(duration*SR)]
    mix[:int(.05*SR)]*=np.linspace(0,1,int(.05*SR))[:,None]
    mix[-int(1.6*SR):]*=np.linspace(1,0,int(1.6*SR))[:,None]
    mix=np.tanh(mix*1.35)
    peak=float(np.max(np.abs(mix)));mix*=.84/max(peak,.01)
    pcm=(mix*32767).astype('<i2')
    with tempfile.TemporaryDirectory() as tmp:
        wav=Path(tmp)/'mix.wav'
        with wave.open(str(wav),'wb') as f:
            f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm.tobytes())
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-hide_banner','-loglevel','error','-i',str(wav),'-codec:a','libmp3lame','-b:a','128k','-metadata',f'title=ConectAi - {slug}',str(OUT/f'{slug}.mp3')],check=True)
    info={'track':slug,'bpm':bpm,'bars':48,'duration':round(duration,2),'peak_dbfs':round(20*np.log10(float(np.max(np.abs(mix)))),2),'rms_dbfs':round(20*np.log10(float(np.sqrt(np.mean(mix**2)))),2),'bytes':(OUT/f'{slug}.mp3').stat().st_size}
    print(info,flush=True)
    return info

if __name__=='__main__':
    report=[render('jardim-de-conexoes',100,'bossa',0),render('passo-de-camaleao',112,'swing',5),render('fim-de-tarde',82,'dream',2)]
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf8')
