"""Render and exercise the three light modes in Chromium or WebKit.

Requires Python Playwright, Pillow and the selected browser. Starts its own
local server. ENGINE, CHROMIUM_EXECUTABLE and OCEAN_TEST_OUTPUT are optional.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from playwright.sync_api import sync_playwright
import threading, os, json

root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('OCEAN_TEST_OUTPUT','/tmp/little-ocean-cosmos'))
out.mkdir(parents=True,exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
name=os.environ.get('ENGINE','chromium')
with sync_playwright() as p:
    browser=(p.webkit.launch(headless=True) if name=='webkit' else p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']))
    context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1.5,has_touch=True,reduced_motion='reduce',accept_downloads=True)
    page=context.new_page();errors=[];results={}
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.goto(f'http://127.0.0.1:{server.server_port}/little-ocean/',wait_until='networkidle')
    page.wait_for_function('window.oceanDiagnostics?.().ready',timeout=90000)
    d=lambda:page.evaluate('oceanDiagnostics()')
    def capture(label):
        page.evaluate('document.activeElement.blur()')
        page.screenshot(path=str(out/f'{name}-{label}.png'))
        results[label]=d();print(name,label,'rendered',flush=True)
    assert d()['lighting']=='day' and d()['glowingFish']==0 and d()['stars']==0
    assert not d()['spectral'] and d()['reefDepthWrites'] and d()['bubbles']==0
    capture('day-phone')
    page.locator('#light').click();page.wait_for_function('oceanDiagnostics().moon>.99',timeout=90000)
    assert d()['lighting']=='moon' and d()['glowingFish']==0
    capture('moon-phone')
    page.locator('#light').click();page.wait_for_function('oceanDiagnostics().cosmos>.99',timeout=90000)
    assert d()['lighting']=='cosmos' and d()['glowingFish']==156 and d()['stars']==1400,d()
    assert d()['spectral'] and d()['spectralMeshes']>=10 and not d()['reefDepthWrites'] and d()['bubbles']==96,d()
    assert page.locator('#light-mode').input_value()=='cosmos'
    assert 'Cosmos' in page.locator('#light').get_attribute('aria-label')
    capture('cosmos-phone')
    # The same scene can be inspected closely and then resized without entering the tank.
    if name=='chromium':
        cdp=context.new_cdp_session(page)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':165,'y':450,'id':1},{'x':225,'y':450,'id':2}]})
        for x in [155,140,120,100,80,60]:
            cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':450,'id':1},{'x':390-x,'y':450,'id':2}]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    else:
        page.mouse.move(200,440);page.mouse.wheel(0,-780)
    page.wait_for_function('oceanDiagnostics().orbitDistance<26',timeout=90000)
    capture('cosmos-close')
    page.set_viewport_size({'width':834,'height':1194})
    page.locator('#drift').click();page.wait_for_function('oceanDiagnostics().orbitZoom===1')
    capture('cosmos-ipad')
    page.set_viewport_size({'width':1366,'height':1024})
    capture('cosmos-desktop')
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#swim').click();page.wait_for_function('oceanDiagnostics().transition===0',timeout=90000)
    assert d()['fov']==62 and d()['lighting']=='cosmos'
    capture('cosmos-swim')
    # Photo must include the dark sky and stars as well as the glowing reef.
    page.locator('#settings').click()
    with page.expect_download() as info:page.locator('#photo').click()
    info.value.save_as(str(out/f'{name}-cosmos-photo.png'))
    assert (out/f'{name}-cosmos-photo.png').stat().st_size>5000
    page.locator('#quality').select_option('low')
    page.wait_for_function('oceanDiagnostics().glowingFish===92 && oceanDiagnostics().stars===600 && oceanDiagnostics().bubbles===40')
    page.locator('#pause').click();page.keyboard.press('Escape')
    page.wait_for_function('oceanDiagnostics().time>.2',timeout=90000)
    page.locator('#feed').click();assert d()['feeding']>10
    page.locator('#settings').click();page.locator('#pause').click()
    frozen=d()['time'];page.wait_for_timeout(250);assert d()['time']==frozen
    # Food is uploaded lazily on its first visible frame. Count after that warmup.
    geometries=d()['geometryCount']
    # Selection, header cycle and return to Day keep all controls in agreement.
    for mode in ['day','cosmos','moon','cosmos','day','moon','cosmos']:
        page.locator('#light-mode').select_option(mode)
        assert d()['lighting']==mode
        assert page.locator('#light').get_attribute('data-mode')==mode
    page.keyboard.press('Escape');page.locator('#light').click()
    page.wait_for_function('oceanDiagnostics().cosmos<.0001 && oceanDiagnostics().moon<.0001',timeout=90000)
    assert d()['lighting']=='day' and d()['glowingFish']==0 and d()['stars']==0
    assert not d()['spectral'] and d()['reefDepthWrites'] and d()['bubbles']==0,d()
    assert d()['geometryCount']==geometries,d()
    page.locator('#drift').click();page.wait_for_function('oceanDiagnostics().transition===0',timeout=90000)
    for w,h in [(375,453),(844,390),(430,932)]:
        page.set_viewport_size({'width':w,'height':h})
        page.locator('#settings').click()
        for selector in ['#light','#light-mode','#close-settings']:
            box=page.locator(selector).bounding_box()
            assert 0<=box['x'] and box['x']+box['width']<=w+.5 and 0<=box['y'] and box['y']+box['height']<=h+.5,(selector,box)
        page.keyboard.press('Escape')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    results['final']=d();results['console_errors']=errors
    out.joinpath(f'{name}-results.json').write_text(json.dumps(results,indent=2))
    print(name,'PASS: light cycle, emission, close view, Swim, photo, quality, feed, pause, resize, stable geometry; no console errors.',flush=True)
    browser.close()
server.shutdown()
