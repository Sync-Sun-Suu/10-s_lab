# Little Ocean · 10718

**[水槽を開く →](https://sync-sun-suu.github.io/10-s_lab/little-ocean/)**

A greenhouse beneath the tide. 青緑の光、白い砂、岩のアーチ、桃色のサンゴ。魚の群れの上を、一匹のエイがゆっくり巡る。10とSumieの、潜れる小さな水槽。

## 遊び方

- **Drift**：水槽を眺める。ドラッグで回し、ピンチ／ホイールで近づく。もう一度押すと最初の眺めへ戻る。
- **Swim**：水槽の中へ。左の丸で移動、画面をなぞって見回す。右の上下ボタンで深さを変える。キーボードはWASD／矢印、Q・Eで上下。
- 下の粒を押すと小さなごはん。魚が近くに集まる。
- 太陽で昼と月明かりを切り替え、スピーカーで水の音。最初は無音。
- 設定からPause、描画の細かさ、Photo、画面拡大。ホーム画面への追加に対応。
- 海の底に置いてきた、小さなコーヒーカップも探してみて。

## 実装

2026-11-17 / v1.0.0。静的HTML・CSS・JavaScript、ローカル同梱のThree.js r170（MIT / [`vendor/THREE-LICENSE.txt`](vendor/THREE-LICENSE.txt)）。ビルド不要、外部CDN・外部フォント・解析・ログインなし。

景色、生き物、アイコン、光、水音はコードで生成。156匹の魚、隣接個体との分離・群れの目標・岩回避、泳ぐメッシュ、エイの翼、水草の揺れ、砂と岩のコースティクス、影、光の筋を組み合わせる。Gentle設定は魚92匹、草と海藻の本数、ピクセル比を減らす。生態・飼育条件を再現したシミュレーターではなく、自由に泳ぐための空想の海。

Swimには範囲制限と岩の簡易衝突判定がある。Pause中も視点は操作できる。非表示タブでは描画と音を停止する。音はタップ後のみ開始。写真は背景と3Dを一枚のPNGへ合成する。

Service Workerで初回の取得後にオフライン利用できる。キャッシュは`little-ocean-`で分離し、時計など他作品のキャッシュを削除しない。WebGLが使えない／途中で失われた場合は再読込の入口を表示する。

## 確認

Linux Chromium・Linux WebKitで実描画、ドラッグ、Swim、移動、ジョイスティック解放、Pause、設定、昼夜、音のオン／オフとタブ休止、PNG保存、画面幅変更、WebGL喪失時の復帰画面を確認。375×453、480×620、834×1194、844×390、1366×1024で操作部の収まりを確認。Chromiumで初回取得後のオフライン再読込を確認。

iPad実機の描画速度・ホーム画面からの操作はSumieの確認待ち。スクリーンショットの紹介作品は着想のきっかけ。この実装は独自に制作し、97 KB・単一HTML・WebGPUという条件は採用していない。

ブラウザ回帰確認は[`tests/browser_check.py`](tests/browser_check.py)。リポジトリ直下を`python -m http.server 8765`で配信し、Python PlaywrightとChromiumを用意して実行する。`ENGINE=webkit`でWebKitを選べる。`OCEAN_URL`・`CHROMIUM_EXECUTABLE`・`OCEAN_TEST_OUTPUT`でURL・実行ファイル・結果の保存先を変更できる。

Made by 10, with Sumie. 10718.
