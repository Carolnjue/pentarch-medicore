import base64, html, json, os, subprocess, sys, wave
from scenes import SCENES
OUT = '/home/claude/tts/out'; os.makedirs(OUT, exist_ok=True)
W, H, FPS = 1920, 1080, 30

def b64(p):
    ext = 'png' if p.endswith('.png') else 'jpeg'
    return f'data:image/{ext};base64,' + base64.b64encode(open(p, 'rb').read()).decode()

CSS = """
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;overflow:hidden;font-family:'DM Sans',Arial,sans-serif;background:#F7F5F0;color:#3D475C}
.dk{background:#061423;color:#C9D4E5}
.wrap{position:absolute;inset:0;padding:90px 120px}
.bar{position:absolute;left:0;right:0;bottom:0;height:12px;background:linear-gradient(100deg,#EE4B3B 0%,#F6B22C 48%,#14B1AC 100%)}
.brand{position:absolute;right:120px;top:70px;font:800 34px 'Bricolage Grotesque',Arial,sans-serif;letter-spacing:.06em;background:linear-gradient(100deg,#EE4B3B,#F6B22C 48%,#14B1AC);-webkit-background-clip:text;color:transparent}
.brand small{display:block;font:600 15px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#646E82;-webkit-text-fill-color:#646E82;text-align:right}
.k{font:600 24px 'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.14em;color:#EE4B3B}
h1{font:800 76px/1.05 'Bricolage Grotesque',Arial,sans-serif;color:#121A2E;letter-spacing:-.02em;margin-top:22px;max-width:1300px}
.dk h1{color:#fff;font-size:110px}
.sub{font-size:36px;margin-top:30px;max-width:1300px;line-height:1.4}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:36px;margin-top:80px}
.card{background:#fff;border:2px solid #E4E0D7;border-radius:30px;padding:46px}
.card b{font:800 44px 'Bricolage Grotesque',Arial,sans-serif;color:#121A2E;display:block;margin-bottom:18px}
.card span{font-size:31px;line-height:1.4}
.card i{display:block;width:70px;height:10px;border-radius:9px;margin-bottom:28px}
ol,ul{margin-top:60px;padding:0;list-style:none;display:grid;gap:26px;counter-reset:n}
li{font-size:38px;line-height:1.3;display:flex;gap:28px;align-items:flex-start;counter-increment:n}
li::before{content:counter(n);flex:none;width:62px;height:62px;border-radius:18px;background:#0A1530;color:#fff;display:grid;place-items:center;font:700 30px 'JetBrains Mono',monospace;margin-top:-6px}
.shot{position:absolute;left:120px;right:120px;top:300px;bottom:70px;border-radius:24px;overflow:hidden;border:2px solid #E4E0D7;box-shadow:0 40px 80px -40px rgba(10,21,48,.5);background:#fff}
.shot img{width:100%;display:block}
.phones{position:absolute;right:160px;top:120px;display:flex;gap:50px}
.phones div{width:390px;height:840px;border-radius:52px;border:14px solid #0A1530;overflow:hidden;background:#fff;box-shadow:0 40px 80px -30px rgba(10,21,48,.6)}
.phones img{width:100%;display:block}
.left{max-width:780px}
table{margin-top:60px;border-collapse:collapse;width:100%;font-size:36px}
td{padding:22px 26px;border-top:2px solid #E4E0D7}
td:first-child{font:700 34px 'JetBrains Mono',monospace;color:#EE4B3B;width:220px}
tr:first-child td{border-top:0}
"""
FONTS = "<link href='https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@600;700&display=swap' rel='stylesheet'>"
COL = ['#EE4B3B', '#14B1AC', '#1F3C7A']

def slide(s):
    e = html.escape
    brand = "<div class='brand'>PENTARCH<small>MEDICORE</small></div>"
    k, t = e(s['kicker']), e(s['title'])
    if s['kind'] in ('title', 'end'):
        body = f"<body class='dk'><div class='wrap' style='display:flex;flex-direction:column;justify-content:center'>{brand}<div class='k'>{k}</div><h1>{t}</h1><p class='sub'>{e(s['sub'])}</p></div><div class='bar'></div>"
    elif s['kind'] == 'cards':
        cards = ''.join(f"<div class='card'><i style='background:{COL[i]}'></i><b>{e(a)}</b><span>{e(b)}</span></div>" for i, (a, b) in enumerate(s['cards']))
        body = f"<body><div class='wrap'>{brand}<div class='k'>{k}</div><h1>{t}</h1><div class='cards'>{cards}</div></div><div class='bar'></div>"
    elif s['kind'] == 'list':
        items = ''.join(f"<li>{e(x)}</li>" for x in s['items'])
        body = f"<body><div class='wrap'>{brand}<div class='k'>{k}</div><h1>{t}</h1><ol>{items}</ol></div><div class='bar'></div>"
    elif s['kind'] == 'table':
        rows = ''.join(f"<tr><td>{e(a)}</td><td>{e(b)}</td></tr>" for a, b in s['rows'])
        body = f"<body><div class='wrap'>{brand}<div class='k'>{k}</div><h1>{t}</h1><table>{rows}</table></div><div class='bar'></div>"
    elif s['kind'] == 'shot':
        body = f"<body><div class='wrap'>{brand}<div class='k'>{k}</div><h1>{t}</h1></div><div class='shot'><img src='{b64(s['img'])}'></div><div class='bar'></div>"
    elif s['kind'] == 'phone':
        ph = ''.join(f"<div><img src='{b64(p)}'></div>" for p in s['imgs'])
        body = f"<body><div class='wrap'><div class='left'><div class='k'>{k}</div><h1>{t}</h1><p class='sub'>Open the client, tap <b>Start 30-day demo</b>, then <b>Send sign-in on WhatsApp</b>.</p></div></div><div class='phones'>{ph}</div><div class='bar'></div>"
    return f"<!doctype html><html><head><meta charset='utf-8'>{FONTS}<style>{CSS}</style></head>{body}</body></html>"

def render_slides():
    for i, s in enumerate(SCENES):
        open(f'{OUT}/s{i:02d}.html', 'w').write(slide(s))
    js = """const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
for(const f of process.argv.slice(2)){await p.goto('file://'+f);await p.waitForTimeout(700);await p.screenshot({path:f.replace('.html','.jpg'),type:'jpeg',quality:92});}await b.close();})();"""
    open(f'{OUT}/shot.js', 'w').write(js)
    subprocess.run(['node', f'{OUT}/shot.js'] + [f'{OUT}/s{i:02d}.html' for i in range(len(SCENES))], check=True, cwd='/home/claude/pentarch-medicore')

def tts():
    m = '/home/claude/tts/vits-piper-en_GB-southern_english_female-medium/en_GB-southern_english_female-medium.onnx'
    for i, sc in enumerate(SCENES):
        subprocess.run([sys.executable, '-m', 'piper', '-m', m, '-f', f'{OUT}/a{i:02d}.wav', '--length-scale', '1.05', '--sentence-silence', '0.35'], input=sc['say'].encode(), check=True, capture_output=True)

def dur(p):
    with wave.open(p) as w: return w.getnframes() / w.getframerate()

def video():
    parts = []
    for i in range(len(SCENES)):
        d = dur(f'{OUT}/a{i:02d}.wav') + 1.0
        tmp, fin = f'{OUT}/v{i:02d}.tmp.mp4', f'{OUT}/v{i:02d}.mp4'
        # gentle push-in plus fade in/out, with the narration starting 0.4 s in
        vf = (f"scale=2112:1188,zoompan=z='1+0.04*on/({int(d*FPS)})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},"
              f"fade=t=in:st=0:d=0.4,fade=t=out:st={d-0.4:.2f}:d=0.4,format=yuv420p")
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-framerate', str(FPS), '-t', f'{d:.2f}', '-i', f'{OUT}/s{i:02d}.jpg',
                        '-i', f'{OUT}/a{i:02d}.wav', '-filter_complex', f'[0:v]{vf}[v];[1:a]adelay=400|400,apad,atrim=0:{d:.2f},aresample=48000[a]',
                        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-t', f'{d:.2f}', tmp], check=True)
        os.replace(tmp, fin); parts.append(fin)
    open(f'{OUT}/list.txt', 'w').write(''.join(f"file '{p}'\n" for p in parts))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{OUT}/list.txt', '-c', 'copy', '-movflags', '+faststart', f'{OUT}/MediCore-Agent-Training.mp4'], check=True)

if __name__ == '__main__':
    step = sys.argv[1]
    {'slides': render_slides, 'tts': tts, 'video': video}[step]()
