from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import threading, os, subprocess, json

root=Path(os.environ.get('OCEAN_REPO_ROOT',Path(__file__).resolve().parents[2]))
out=Path(os.environ.get('OCEAN_TEST_OUTPUT','/tmp/little-ocean-clarity'));out.mkdir(parents=True,exist_ok=True)
name=os.environ.get('ENGINE','chromium')
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/little-ocean/'
baseline=os.environ.get('OCEAN_BASELINE_REF')
old=subprocess.check_output(['git','show',baseline+':little-ocean/ocean.js'],cwd=root).decode() if baseline else None
with sync_playwright() as p:
    b=(p.webkit.launch(headless=True) if name=='webkit' else p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']))
    samples={}; errors=[]
    for variant in (['before','after'] if baseline else ['after']):
        ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True,reduced_motion='reduce',service_workers='block')
        page=ctx.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        if variant=='before': page.route('**/ocean.js',lambda route:route.fulfill(status=200,body=old,content_type='text/javascript'))
        page.goto(url,wait_until='networkidle')
        page.wait_for_function('window.oceanDiagnostics?.().ready',timeout=90000)
        d=lambda:page.evaluate('oceanDiagnostics()')
        page.screenshot(path=str(out/f'{name}-clarity-{variant}-phone.png'))
        samples[variant]=d(); print(name,variant,'rendered',flush=True)
        page.mouse.move(200,440);page.mouse.wheel(0,-280)
        page.wait_for_timeout(600)
        page.screenshot(path=str(out/f'{name}-clarity-{variant}-old-limit.png'))
        if variant=='after':
            assert d()['fogDensity']*d()['orbitDistance']<=.481,d()
            page.locator('#drift').click()
            if name=='chromium':
                cdp=ctx.new_cdp_session(page)
                cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':165,'y':450,'id':1},{'x':225,'y':450,'id':2}]})
                for x in [155,140,120,100,80,60]:
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':450,'id':1},{'x':390-x,'y':450,'id':2}]})
                cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                page.wait_for_function('oceanDiagnostics().orbitZoom<.4')
                assert abs(d()['orbitZoom']-60/270)<.02,d()
            else:
                page.mouse.move(200,440);page.mouse.wheel(0,-780);page.wait_for_function('oceanDiagnostics().orbitZoom<.4')
            page.wait_for_function('oceanDiagnostics().orbitDistance<26')
            close=d();assert close['orbitDistance']>=20.8,close
            page.screenshot(path=str(out/f'{name}-clarity-close.png'));samples['close']=close
            page.mouse.move(200,440);page.mouse.wheel(0,-10000);page.wait_for_function('oceanDiagnostics().orbitDistance<23')
            assert 21<d()['orbitDistance']<23,d()
            page.set_viewport_size({'width':1366,'height':1024});page.wait_for_timeout(800)
            assert d()['orbitDistance']>=21,d()
            page.locator('#drift').click();page.wait_for_function('oceanDiagnostics().orbitZoom===1')
            page.screenshot(path=str(out/f'{name}-clarity-desktop.png'))
            page.set_viewport_size({'width':834,'height':1194});page.wait_for_timeout(600)
            assert d()['fogDensity']*d()['orbitDistance']<=.481
            page.screenshot(path=str(out/f'{name}-clarity-ipad.png'))
            page.set_viewport_size({'width':390,'height':844});page.locator('#swim').click()
            page.wait_for_function('oceanDiagnostics().transition===0',timeout=90000)
            assert d()['fogDensity']==.048 and d()['fov']==62,d()
            page.locator('#drift').click();page.wait_for_function('oceanDiagnostics().transition===0',timeout=90000)
            assert d()['fogDensity']*d()['orbitDistance']<=.481
            page.locator('#light').click();page.wait_for_function('oceanDiagnostics().moon>.98',timeout=60000)
            page.evaluate('document.activeElement.blur()');page.screenshot(path=str(out/f'{name}-clarity-night.png'))
            page.locator('#settings').click();page.locator('#quality').select_option('low');page.keyboard.press('Escape')
            assert d()['quality']=='low' and d()['fogDensity']*d()['orbitDistance']<=.481
            for w,h in [(375,812),(430,932),(375,453),(844,390)]:
                page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(200)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                assert d()['fogDensity']*d()['orbitDistance']<=.481
            samples['final']=d()
        ctx.close()
    assert not errors,errors
    for variant in (['before','after'] if baseline else ['after']):
        im=Image.open(out/f'{name}-clarity-{variant}-phone.png').convert('RGB').resize((390,844))
        samples[variant]['crop_rgb_stddev']=ImageStat.Stat(im.crop((30,350,360,555))).stddev
    print(name,json.dumps(samples),flush=True)
    out.joinpath(f'results-clarity-v101-{name}.json').write_text(json.dumps(samples,indent=2))
    b.close()
server.shutdown()
