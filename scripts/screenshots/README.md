# README screenshots

Taken from a **synthetic demo athlete** — never from a real athlete's data (the repo is public).

```bash
cp -R assets/scaffold /tmp/strata-demo && cd /tmp/strata-demo && npm install
python3 <plugin>/scripts/screenshots/make_demo.py      # writes athletes/alex (dates relative to its `today`)
npx vite build && npx vite preview --port 4590 --strictPort &
node <plugin>/scripts/screenshots/shoot.mjs <plugin>/docs/screenshots   # headless Chrome via DevTools
```

`shoot.mjs` needs Google Chrome installed; it opens each tab through the URL hash (`/alex#runs`)
and waits for the charts to draw before capturing.
