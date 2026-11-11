# CARBON — Considered automotive parts

CARBON is an existing responsive storefront concept for premium performance and interior parts. Run it over HTTP: browsers block JavaScript modules and Three.js imports when opened as a `file://` URL.

On Windows, double-click `start-carbon.cmd` to launch the local server and open `http://127.0.0.1:4173`. Or run `node server.mjs` from this directory.

## Storefront

- Editorial homepage, featured categories, product pages, image galleries, account, saved builds, cart and checkout preview.
- Catalog filters by category, selected car, selected configurator part, search, price, rating and name.
- The catalog marks vehicle fitment as verified only when an exact vehicle and part are recorded with an evidence URL. Existing demo products remain unverified. Universal USB accessories are clearly described as general accessories that require a power and installation check.
- Responsive fixed navigation, compact phone/tablet 3D studio controls and dark liquid-glass styling.
- Product photos are stored in `assets/`; see [`assets/ASSETS.md`](assets/ASSETS.md) for image source and license notes.

## Store management

Open `#admin` or choose **Manage** in the navigation/footer. The passwordless admin is an intentionally local prototype. It supports adding, editing and removing products; maintaining vehicle records; editing categories; recording verified fitment evidence; assigning part keys and badges; and adding product or vehicle photos by URL or upload. Uploaded photos are resized and converted to WebP before being stored.

Content uses the versioned schema in `store-repository.js` and a small `getStoreContent` / `saveStoreContent` interface. Today, that adapter stores records in this browser's local storage. Replace the adapter with an authenticated API implementation when a backend is ready; no credentials or secrets are in the frontend. Browser-local storage is suitable only for this prototype and has no shared users, access control, backups or production media hosting.

Vehicles include Porsche 911 generations and GT3 RS, BMW M2/M3/M4/M5, Mercedes-AMG, Audi RS, Lexus RC F and McLaren models. Vehicle fitment remains unverified unless an administrator records the exact car, selected part and source evidence. The broad Mercedes/Audi rows indicate model families and are not fitment claims.

## 3D studio

The current scene uses `assets/unbranded-mid-engine-supercar.glb`, a 3.95 MB CC0 unbranded concept vehicle by Innerscene. It is not a Porsche 911 GT3 RS. The studio currently recognizes modeled wheels, seats, steering, hood surface, exhaust, brakes, body, mirrors and lights; the spoiler control is disabled when its geometry is absent. Selection restores the chosen mesh's original material and dims the remaining model. Camera orbit, pan and zoom persist through selections; view presets and reset are explicit controls. See [`assets/LICENSE-unbranded-mid-engine-supercar.txt`](assets/LICENSE-unbranded-mid-engine-supercar.txt).

An exact high-detail 2023 Porsche 911 GT3 RS model with separate parts and a commercial web-app license was found at 3DExport. Its Basic License is currently listed at **US$175**. The model was not downloaded into this project because purchase has not been authorized. See [the listing and its license details](https://3dexport.com/3d-model-porsche-911-gt3-rs-2023-429409).

## AliExpress research

The small cabin-light entries are universal-accessory concepts rather than vehicle-specific fitment. The original vector product image (`assets/product-usb-ambient.svg`) is an illustrative rendering, not an AliExpress seller photo. The [AliExpress bestseller research guide](https://topachados.app/en/guides/car-led-interior-lights-best-sellers) reports popular compact USB ambient-light options around $1.78–$2.24, with one option at 4.9 and 10k+ sold; live prices, specifications and listing status can change. The second RGB kit links to its [AliExpress listing](https://www.aliexpress.com/item/1005013255469514.html). Verify supplier image rights, shipping, quality, current price and exact product specs before stocking or reselling.

## Demo limits

Store prices and inventory are illustrative. Cart, wishlist, account and orders are saved locally. Checkout does not collect payment or submit an order, and newsletter feedback does not send email. Production sales still need real inventory, reviewed fitment evidence, backend authentication, shared persistence, image hosting, payment and account services.
