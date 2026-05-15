# RE4MerchantShop

Solidity contract and static frontend for a dark merchant-shop themed Web3 mini game.

## Files

- `contracts/RE4MerchantShop.sol`
- `frontend/index.html`
- `frontend/style.css`
- `frontend/app.js`
- `frontend/abi.js`
- `frontend/config.js`
- `assest/map/`
  - map images such as `mainhall.png`, `pianoroom.png`, `library.png`, `diningroom.png`
  - optional foreground images such as `mainhall_objectives.png`
  - optional phase images such as `mainhall1.png`, `mainhall2.png`
- `assest/interactive/`
  - first-person interaction images such as clocks, pianos, notes, and objects

## Deployed Contract

Network:

```text
Sepolia
```

Contract address:

```text
0x106320873d4752bbc303cc72521640c1b591378b
```

## Run Locally

Open PowerShell in the `project` folder and run:

```powershell
python -m http.server 8010 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8010/frontend/index.html
```

MetaMask must be installed and connected to Sepolia.

## Frontend Setup

The frontend reads the contract address from `frontend/config.js`.

```js
const SHOP_CONFIG = {
  contractAddress: "0x106320873d4752bbc303cc72521640c1b591378b",
  sepoliaChainId: "0xaa36a7"
};
```

You can also paste another deployed contract address in the app and press `Set`.

## Basic Test Flow

1. Connect MetaMask.
2. Switch to Sepolia if needed.
3. Register a player.
4. Buy an item.
5. Upgrade a weapon.
6. Sell an item.
7. Refresh inventory.
8. Check the transaction log.

## Game Controls

```text
WASD / Arrow keys: Move
E: Interact
I: Open or close inventory
Esc: Close merchant menu or inventory
```

In Main Hall, approach the merchant access circle and press `E` to open the in-game merchant menu.

## Debug Editor

Open the `Debug` tab to edit the game map.

Maps are auto-detected from:

```text
assest/map/
```

First-person interaction images are read from:

```text
assest/interactive/
```

To add a new map, put a `.png`, `.jpg`, `.jpeg`, or `.webp` file in that folder and reload the page.
For a foreground/object layer, add another image with `_objectives` before the extension:

```text
newroom.png
newroom_objectives.png
```

The base map and `_objectives` image should have the same size so they overlap correctly.

### Map Phases

同じ部屋で状態違いを作る場合は、同じ部屋名の後ろに番号を付けます。

```text
mainhall1.png
mainhall2.png
mainhall1_objectives.png
mainhall2_objectives.png
```

`mainhall1.png` と `mainhall2.png` はどちらも `mainhall` として扱われ、Debug画面の `Phase` から切り替えできます。
`mainhall3.png`、`mainhall4.png` のように番号を増やすと、Debug画面の `Phase` にも追加されます。
ドア、当たり判定、コメント、ろうそく、Spawn、商人設定はPhase単位で保存されます。
別Phaseの設定を使いたい場合は、Debug画面の `Inherit Phase` を押してコピー元Phaseを選びます。
コピー後にPhase 2だけ当たり判定を追加しても、Phase 1には影響しません。
`フェーズ削除` はブラウザ上でそのフェーズを非表示にするだけで、画像ファイル自体は削除しません。

Available tools:

- `当たり判定線`: click points to draw wall collision lines.
- `コメント追加`: add an interaction comment area.
- `Interaction`: add a first-person image interaction area. Enter the image file name from `assest/interactive/`, then write text pages separated with `|`.
- `ドア追加`: click an entrance, choose target room, then click the target spawn position.
- `商人設定`: place the merchant in Main Hall.
- `ろうそく`: add animated candle light points.
- `Spawn設定`: set the room's initial spawn point.
- `削除`: remove nearby debug objects.
- `Inherit Phase`: copy debug data from another phase into the selected phase.
- `最後を戻す`: undo the previous edit.
- `部屋をクリア`: clear debug data in the selected room and phase.

Debug editor shortcuts:

```text
Ctrl + Z: Undo
Alt + mouse wheel: Zoom
Shift + mouse wheel: Move X axis
Ctrl + mouse wheel: Move Y axis
```

Debug data is saved in browser `localStorage`.

Interaction controls:

```text
E: Open the interaction when standing inside its area
Enter: Advance text pages
Esc: Close the interaction and return to the map
```
