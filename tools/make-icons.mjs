// Renders assets/icon.svg to assets/icon-180.png (apple-touch-icon) with headless Chrome.
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const svg = await readFile(new URL('../play/assets/icon.svg', import.meta.url), 'utf8');
const which = process.env.PW_BROWSER || 'chrome';
const browser = await chromium.launch(which === 'chromium' ? {} : { channel: which });
const page = await browser.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><style>html,body{margin:0;background:#ffa0aa}svg{display:block;width:180px;height:180px}</style>${svg}`);
await page.screenshot({ path: fileURLToPath(new URL('../play/assets/icon-180.png', import.meta.url)) });
await browser.close();
console.log('ICON_OK assets/icon-180.png');
