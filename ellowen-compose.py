"""An original 24-bar music-box miniature for Ellowen, by 10 / 10718.
No samples, external recordings, or existing melody. Key: D major. 3/4, 78 bpm.
The two answering motifs meet in the last phrase. Rendered with damped tines.
"""
from pathlib import Path
import math, wave, subprocess
import numpy as np

ROOT = Path(__file__).resolve().parent
(ROOT / "dist").mkdir(exist_ok=True)
SR = 44100
BEAT = 60 / 78
OFFSET = 0.35
# Each pair is (pitch, duration in beats); each bar sums to three.
BARS = [
 [('F#5',1),('A5',.5),('B5',.5),('A5',1)],
 [('E5',1),('F#5',1),('A5',1)],
 [('D5',1),('F#5',.5),('A5',.5),('B5',1)],
 [('A5',2),('F#5',1)],
 [('G5',1),('F#5',.5),('E5',.5),('D5',1)],
 [('E5',1),('A5',1),('F#5',1)],
 [('E5',1),('C#5',1),('E5',1)],
 [('D5',2),('A4',1)],
 [('B5',1.5),('A5',.5),('F#5',1)],
 [('A5',1),('F#5',1),('E5',1)],
 [('G5',1),('B5',.5),('D6',.5),('B5',1)],
 [('A5',2),('F#5',1)],
 [('B5',1),('A5',.5),('G5',.5),('F#5',1)],
 [('G5',1.5),('F#5',.5),('E5',1)],
 [('A5',1),('E5',1),('C#5',1)],
 [('D5',2),('F#5',1)],
 [('F#5',1),('A5',.5),('B5',.5),('A5',1)],
 [('E5',1),('F#5',1),('A5',1)],
 [('D6',1.5),('B5',.5),('A5',1)],
 [('F#5',2),('E5',1)],
 [('G5',1),('F#5',.5),('E5',.5),('D5',1)],
 [('E5',1),('A5',1),('C#6',1)],
 [('B5',1),('A5',1),('F#5',1)],
 [('D5',3)],
]
CHORDS = [
 ('D3','A3','F#4'),('A3','C#4','E4'),('B3','D4','F#4'),('F#3','A3','D4'),
 ('G3','B3','D4'),('D3','A3','F#4'),('A3','C#4','E4'),('D3','A3','F#4'),
 ('B3','D4','F#4'),('F#3','A3','C#4'),('G3','B3','D4'),('D3','A3','F#4'),
 ('G3','B3','D4'),('E3','B3','G4'),('A3','C#4','E4'),('D3','A3','F#4'),
 ('D3','A3','F#4'),('A3','C#4','E4'),('B3','D4','F#4'),('F#3','A3','D4'),
 ('G3','B3','D4'),('A3','C#4','E4'),('G3','A3','E4'),('D3','A3','F#4'),
]
N = int((OFFSET + 72 * BEAT + 5.5) * SR)
mix = np.zeros((N,2), dtype=np.float64)
pitchclass={'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
def hz(note):
    midi=12*(int(note[-1])+1)+pitchclass[note[:-1]]
    return 440*2**((midi-69)/12)

def chime(note, at, amplitude, pan=0, decay=2.0):
    f=hz(note)
    n=int(4.8*SR)
    t=np.arange(n)/SR
    # Gentle, rounded attack; upper partials decay faster than the fundamental.
    attack=1-np.exp(-t/0.004)
    tone=np.zeros(n)
    for ratio, weight, damping in [(1,1,1),(2,.20,.55),(3,.075,.36),(5.02,.028,.20)]:
        tone+=weight*np.sin(2*np.pi*f*ratio*t)*np.exp(-t/(decay*damping))
    tone*=attack*amplitude
    tone[-600:]*=np.linspace(1,0,600)
    start=int(at*SR); end=min(start+n,N); tone=tone[:end-start]
    mix[start:end,0]+=tone*math.sqrt((1-pan)/2)
    mix[start:end,1]+=tone*math.sqrt((1+pan)/2)

for bar, melody in enumerate(BARS):
    base=OFFSET+bar*3*BEAT
    b=0
    for i,(note,length) in enumerate(melody):
        velocity=.18*(1+.05*math.sin(bar*1.7+i))
        chime(note,base+b*BEAT,velocity,.16,2.0)
        b+=length
    assert b==3
    for beat,note in enumerate(CHORDS[bar]):
        chime(note,base+beat*BEAT+.022,.065 if beat else .072,-.25,1.65)

# Small stereo room: quiet echoes, no sudden peaks or loud bed.
dry=mix.copy()
for seconds,gain,swap in [(.093,.12,True),(.173,.09,False),(.281,.07,True),(.431,.045,False),(.719,.025,True)]:
    offset=int(seconds*SR)
    mix[offset:]+=gain*(dry[:-offset,::-1] if swap else dry[:-offset])
mix[:600]*=np.linspace(0,1,600)[:,None]
mix[-int(3*SR):]*=np.linspace(1,0,int(3*SR))[:,None]
mix*=.70/max(abs(mix).max(),.001)
pcm=(np.clip(mix,-1,1)*32767).astype('<i2')
wav=ROOT/'Ellowens-Little-Moon.wav'
with wave.open(str(wav),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm.tobytes())
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-codec:a','libmp3lame','-b:a','160k','-metadata','title=Ellowen’s Little Moon','-metadata','artist=10 / 10718',str(ROOT/'dist'/'ellowens-little-moon.mp3')],check=True)
print(f'Original miniature: {N/SR:.1f}s, peak {abs(mix).max():.3f}, 24 bars, D major, 3/4.')
