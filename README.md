# skrebutis

vibe coded toast library. one file, styles included.

**demo:** [pauliusbaulius.github.io/skrebutis](https://pauliusbaulius.github.io/skrebutis/)

## install

```bash
npm i skrebutis
```

## native html

Save as `index.html` and open in a browser. No build step.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>skrebutis html example</title>
</head>
<body>
  <button id="save">save</button>
  <button id="fail">fail</button>
  <button id="load">load</button>

  <script type="module">
    import Toast from "https://cdn.jsdelivr.net/npm/skrebutis/dist/skrebutis.min.js";

    document.getElementById("save").addEventListener("click", () => {
      Toast.success("Saved.", { position: "bottom-right" });
    });

    document.getElementById("fail").addEventListener("click", () => {
      Toast.error("Could not save.");
    });

    document.getElementById("load").addEventListener("click", () => {
      const request = new Promise((resolve, reject) => {
        setTimeout(
          () => (Math.random() > 0.3 ? resolve({ ok: true }) : reject(new Error("timeout"))),
          1200
        );
      });

      Toast.promise(request, {
        loading: "Loading...",
        success: "Ready.",
        error: (err) => `Failed: ${err.message}`,
      }).catch(() => {});
    });
  </script>
</body>
</html>
```

## react

Vite + React. Run `npm i skrebutis`, then use as `src/App.tsx`:

```tsx
import { useState } from "react";
import Toast from "skrebutis";

export default function App() {
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await Toast.promise(
        fetch("/api/save", { method: "POST" }).then((r) => {
          if (!r.ok) throw new Error("save failed");
          return r.json();
        }),
        {
          loading: "Saving...",
          success: "Saved.",
          error: (err) => (err instanceof Error ? err.message : "Failed."),
        },
        { position: "bottom-right" }
      );
    } catch {
      /* toast already showed the error */
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>skrebutis + react</h1>
      <button type="button" onClick={() => Toast.success("Hello from react")}>
        say hi
      </button>
      <button type="button" onClick={save} disabled={busy}>
        {busy ? "saving..." : "save"}
      </button>
      <button type="button" onClick={() => Toast.clear()}>
        clear
      </button>
    </main>
  );
}
```

## local playground

```bash
npm i
./dev.sh   # builds, watches, serves http://127.0.0.1:9999/index.html
```

## notes

- Uses Popover API (`popover=manual`) for top-layer stacking when available; falls back to `document.body`.
- Native `<dialog showModal()>` still shares the top layer — toasts outside the dialog can lose to modal inertness. Prefer in-dialog feedback for modal flows.
