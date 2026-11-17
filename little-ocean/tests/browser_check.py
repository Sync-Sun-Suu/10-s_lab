from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,math
out=Path(os.environ.get('OCEAN_TEST_OUTPUT','/tmp/little-ocean-checks'));out.mkdir(parents=True,exist_ok=True);results=[]
with sync_playwright() as p:
 name=os.environ.get('ENGINE','chromium')
 b=(p.webkit.launch(headless=True) if name=='webkit' else p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']))
 ctx=b.new_context(viewport={'width':900,'height':700},device_scale_factor=1,has_touch=True,accept_downloads=True)
 page=ctx.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(os.environ.get('OCEAN_URL','http://127.0.0.1:8765/little-ocean/'),wait_until='networkidle');page.wait_for_function('window.oceanDiagnostics?.().ready',timeout=90000)
 d=lambda:page.evaluate('oceanDiagnostics()')
 assert d()['time']>=0 and d()['audioState']=='none',d()
 print(name,'loaded',d(),flush=True)
 page.locator('#settings').click();page.locator('#pause').click();assert d()['paused'];page.keyboard.press('Escape');assert page.locator('#settings-panel').is_hidden()
 page.screenshot(path=str(out/f'{name}-day.png'))
 # Camera controls stay usable with animation paused.
 before=d()['camera'];page.mouse.move(450,400);page.mouse.down();page.mouse.move(570,430,steps=5);page.mouse.up();page.wait_for_function('Math.abs(oceanDiagnostics().camera[0]-'+str(before[0])+')>1')
 page.locator('#drift').click();page.locator('#swim').click();assert d()['mode']=='swim'
 page.locator('#ocean').focus();before=d()['swimPosition'];page.keyboard.down('w');page.wait_for_function('oceanDiagnostics().swimPosition[2]<'+str(before[2]-.3));page.keyboard.up('w')
 # Pointer cancellation releases virtual stick; it must never leave movement latched.
 box=page.locator('#joystick').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+20,y-20);assert abs(d()['joystick']['x'])>.1;page.mouse.up();assert d()['joystick']=={'x':0,'y':0}
 page.locator('#feed').click();assert d()['feeding']==13
 page.screenshot(path=str(out/f'{name}-swim.png'))
 # Audio opted in, then muted and suspended on tab hide.
 page.locator('#sound').click();page.wait_for_function('oceanDiagnostics().sound');assert d()['audioState']=='running'
 page.locator('#sound').click();page.wait_for_function('!oceanDiagnostics().sound')
 page.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))")
 page.wait_for_function("oceanDiagnostics().audioState==='suspended'")
 page.evaluate("Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'))")
 assert not d()['sound']
 page.locator('#settings').click();page.locator('#quality').select_option('low');assert d()['fish']==92 and d()['quality']=='low'
 page.locator('#pause').click();page.keyboard.press('Escape');assert not d()['paused']
 page.locator('#light').click();assert d()['night']
 # Pause once moonlight has approached its target (scene time matters, not GPU wall time).
 page.wait_for_function('oceanDiagnostics().time>2',timeout=90000)
 page.locator('#settings').click();page.locator('#pause').click();page.keyboard.press('Escape');page.screenshot(path=str(out/f'{name}-night.png'))
 page.locator('#settings').click()
 with page.expect_download() as info:page.locator('#photo').click()
 download=info.value;download.save_as(str(out/f'{name}-photo.png'));assert Path(out/f'{name}-photo.png').stat().st_size>5000
 page.keyboard.press('Escape');page.locator('#drift').click()
 for w,h in [(375,453),(480,620),(834,1194),(844,390),(1366,1024)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(250)
  rects=page.evaluate('''()=>[...document.querySelectorAll('header button,header a,footer button,.title')].filter(el=>el.getBoundingClientRect().width).map(el=>{const r=el.getBoundingClientRect();return {id:el.id||el.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom}})''')
  assert all(r['x']>=0 and r['y']>=0 and r['right']<=w+.5 and r['bottom']<=h+.5 for r in rects),(w,h,rects)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  if (w,h)==(375,453):page.screenshot(path=str(out/f'{name}-compact.png'))
 print(name,'errors',errors,flush=True);assert not errors,errors
 if name=='chromium':
  page.wait_for_function('navigator.serviceWorker.controller!==null')
  ctx.set_offline(True);page.reload(wait_until='domcontentloaded');page.wait_for_function('window.oceanDiagnostics?.().ready',timeout=90000);assert d()['ready'];ctx.set_offline(False)
 # Intentional WebGL loss must display a recovery control.
 page.evaluate("document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
 page.wait_for_selector('#failure',state='visible');assert page.locator('#reload').is_visible()
 results.append({'engine':name,'render':'passed','touch_keyboard_swim':'passed','pause_camera':'passed','quality':'passed','sound_visibility':'passed','photo':'passed','viewports':5,'offline':name=='chromium','context_loss':'recovery visible','console_errors':errors})
 out.joinpath(f'results-{name}.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(results,flush=True);b.close()
