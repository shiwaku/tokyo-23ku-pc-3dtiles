// PMTilesのMapLibre GL JS用のプロトコルをグローバルに追加
let protocol = new pmtiles.Protocol();
// addProtocolでカスタムURLスキーマを使用するときに呼び出される関数を追加する
// pmtiles://~~ が使用されたときにprotocol.tileが呼び出される
maplibregl.addProtocol("pmtiles", (request) => {
  return new Promise((resolve, reject) => {
    // 非同期処理を行うためにPromiseを作成。成功時にはresolve、失敗時にはrejectで結果を返す。
    const callback = (err, data) => {
      // pmtilesプロトコルのtileメソッドに渡すコールバック関数を定義。エラーがあればrejectし、データがあればresolveする。
      if (err) {
        // エラーが発生した場合
        reject(err); // Promiseを失敗として処理（エラーを返す）
      } else {
        // エラーがなかった場合
        resolve({ data }); // タイルデータを返し、Promiseを成功として処理
      }
    };
    // PMTilesのProtocolオブジェクトのtileメソッドを呼び出して、タイルリクエストを処理
    protocol.tile(request, callback);
  });
});

// マップの初期化
const map = new maplibregl.Map({
  container: "map",
  style: "./std.json", // マップのスタイルを指定
  center: [139.744935, 35.661738], // マップの初期中心点を指定（経度, 緯度）
  zoom: 16.23, // マップの初期ズームレベルを設定
  pitch: 73, // マップの初期ピッチ（傾き）を指定
  maxPitch: 85, // マップの最大ピッチ角度を指定
  bearing: 0, // マップの初期ベアリング（向き）を指定
  hash: true, // URLに地図の状態（中心点座標、ズームレベル、ピッチ、ベアリングなど）を反映させる（地図の状態がURLのハッシュに保存されるため、ページ再読み込み時に同じ状態を保持）
  attributionControl: false, // 著作権表示（アトリビュート）を非表示に設定
});

// ズーム・回転コントロールを追加
map.addControl(new maplibregl.NavigationControl());

// フルスクリーンモードのオンオフ用ボタンを追加
map.addControl(new maplibregl.FullscreenControl());

// 現在位置表示コントロールを追加
map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: false, // 高精度位置情報を使わない（バッテリー節約のため）
    },
    fitBoundsOptions: { maxZoom: 18 }, // 現在位置にズームインする際の最大ズームレベルを指定
    trackUserLocation: true, // ユーザーが移動すると地図上に位置を追跡する
    showUserLocation: true, // ユーザーの現在位置を地図上に表示する
  })
);

// スケール表示を追加
map.addControl(
  new maplibregl.ScaleControl({
    maxWidth: 200, // スケールバーの最大幅
    unit: "metric", // メートル単位で表示
  })
);

// 著作権情報を折りたたみ表示にする
map.addControl(
  new maplibregl.AttributionControl({
    compact: true, // 著作権情報をコンパクトな形式で表示
    customAttribution:
      '<a href="https://www.geospatial.jp/ckan/dataset/tokyopc-23ku-2024" target="_blank">東京都デジタルツイン実現プロジェクト 区部点群データ</a>',
  })
);

// マップがすべて読み込まれた後に実行される処理を設定
map.on("load", () => {
  // 標高タイルDEMソース
  map.addSource("gsi-terrain-dem", {
    type: "raster-dem",
    minzoom: 1,
    maxzoom: 18,
    tiles: [
      "https://xs489works.xsrv.jp/raster-tiles/gsi/gsi-dem-terrain-rgb/{z}/{x}/{y}.png",
    ],
    tileSize: 256,
    attribution:
      "<a href='https://maps.gsi.go.jp/development/ichiran.html#dem' target='_blank'>地理院タイル(標高タイル)</a>",
  });

  // 標高タイルDEMセット
  map.setTerrain({ source: "gsi-terrain-dem", exaggeration: 1 });

  // 3D都市モデル建築物モデル（PMTiles）ソース
  map.addSource("building", {
    type: "vector", // ソースタイプを指定
    url: "pmtiles://https://pmtiles-data.s3.ap-northeast-1.amazonaws.com/plateau/PLATEAU_2022_LOD1.pmtiles", // PMTilesのURLを指定
    minzoom: 14, // ソースの最小ズームレベル
    maxzoom: 16, // ソースの最大ズームレベル
    attribution:
      "<a href='https://www.geospatial.jp/ckan/dataset/plateau' target='_blank'>3D都市モデル Project PLATEAU (国土交通省)</a>, <a href='https://github.com/amx-project/apb' target='_blank'>法務省地図XMLアダプトプロジェクト</a>", // データ提供元のクレジットを設定
  });

  // 3D都市モデル建築物モデル（PMTiles）レイヤ
  map.addLayer({
    id: "bldg-pmtiles", // レイヤのIDを指定
    source: "building", // 使用するソースを指定
    "source-layer": "PLATEAU", // ソース内のレイヤ名を指定
    minzoom: 14, // レイヤの最小ズームレベル
    maxzoom: 23, // レイヤの最大ズームレベル
    type: "fill-extrusion", // レイヤのタイプを指定（3D描画）
    paint: {
      "fill-extrusion-color": "#FFFFFF", // 建物の色を白に設定
      "fill-extrusion-opacity": 1, // 建物の不透明度を設定
      "fill-extrusion-height": ["get", "measuredHeight"], // 建築物の高さ情報をデータの属性から取得して設定
    },
    filter: [
      "all",
      ["==", ["get", "city"], "東京都港区"], // "city" が "東京都港区" の建築物を表示
      ["!=", ["get", "buildingID"], "13103-bldg-16907"], // 指定されたIDの建築物を非表示
    ],
  });

  // deck.glのレイヤーを追加する
  const overlay = new deck.MapboxOverlay({
    interleaved: true, // deck.glレイヤーを他のMapLibre GL JSのレイヤーと重ねて描画
    layers: [
      // 3次元点群データ（3D Tiles）を表示するレイヤーを追加
      new deck.Tile3DLayer({
        id: "pc-3dtiles", // レイヤーIDを設定
        data: "https://shiworks.xsrv.jp/3dtiles/toyko-23ku-pc/tokyo-tower/tileset.json", // 3D TilesのURL
        opacity: 1, // レイヤーの不透明度を設定（1は完全に不透明）
        pointSize: 1, // 3次元点群データのポイントのサイズを設定
        onTileLoad: (d) => {
          const { content } = d;
          // 3次元点群データの高さから標高を差し引く
          // 【標高を取得するAPI】
          // https://api-vt.geolonia.com/altitude.html
          // 下記のURLで緯度、経度をリクエストすると、標高が取得できる
          // https://api-vt.geolonia.com/api/altitude?lat=35.6585805&lng=139.7428526
          content.cartographicOrigin.z -= 0;
        },
      }),
    ],
  });
  // 作成したoverlayを地図に追加
  map.addControl(overlay);

  // Skyレイヤ
  map.setSky({
    "sky-color": "#199EF3",
    "sky-horizon-blend": 0.7,
    "horizon-color": "#f0f8ff",
    "horizon-fog-blend": 0.8,
    "fog-color": "#2c7fb8",
    "fog-ground-blend": 0.9,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 12, 0],
  });
});
