"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

type Status =
  | { type: "loading-ffmpeg" }
  | { type: "ready" }
  | { type: "processing"; progress: number; log?: string }
  | { type: "done"; url: string; filename: string }
  | { type: "error"; message: string };

export default function Page() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [status, setStatus] = useState<Status>({ type: "loading-ffmpeg" });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [gifFile, setGifFile] = useState<File | null>(null);

  const canRun = useMemo(
    () => !!videoFile && !!gifFile && status.type !== "processing" && status.type !== "loading-ffmpeg",
    [videoFile, gifFile, status.type]
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setStatus({ type: "loading-ffmpeg" });

        const ffmpeg = new FFmpeg();

        // carica core wasm da CDN (riduce peso su Vercel)
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
        });

        ffmpeg.on("log", ({ message }) => {
          if (!mounted) return;
          setStatus((s) => (s.type === "processing" ? { ...s, log: message } : s));
        });

        ffmpeg.on("progress", ({ progress }) => {
          if (!mounted) return;
          setStatus((s) => (s.type === "processing" ? { ...s, progress } : s));
        });

        ffmpegRef.current = ffmpeg;
        if (mounted) setStatus({ type: "ready" });
      } catch (e: any) {
        if (mounted) setStatus({ type: "error", message: e?.message ?? "Errore caricando FFmpeg" });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function run() {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !videoFile || !gifFile) return;

    try {
      setStatus({ type: "processing", progress: 0 });

      const inVideo = "input.mp4";
      const inGif = "overlay.gif";
      const outFile = "output.mp4";

      await ffmpeg.writeFile(inVideo, await fetchFile(videoFile));
      await ffmpeg.writeFile(inGif, await fetchFile(gifFile));

      // GIF in loop infinito + blend multiply per tutta la durata del video
      await ffmpeg.exec([
        "-i",
        inVideo,
        "-stream_loop",
        "-1",
        "-i",
        inGif,
        "-filter_complex",
        "[1:v][0:v]scale2ref=iw:ih[gifS][vid];[vid][gifS]blend=all_mode=multiply:all_opacity=1,format=yuv420p[outv]",
        "-map",
        "[outv]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        outFile
      ]);

      const data = await ffmpeg.readFile(outFile);
      const blob = new Blob([data], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      setStatus({
        type: "done",
        url,
        filename: `multiply_${safeName(videoFile.name)}.mp4`
      });
    } catch (e: any) {
      setStatus({ type: "error", message: e?.message ?? "Errore durante la conversione" });
    }
  }

  return (
    <main style={{ maxWidth: 820, margin: "40px auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>Video + GIF (Multiply)</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Carica un video e una GIF: la GIF viene ripetuta per tutta la durata e “fusa” con modalità <b>multiply</b>.
      </p>

      <section style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <label style={card}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>1) Video</div>
          <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
          {videoFile && <div style={small}>{videoFile.name}</div>}
        </label>

        <label style={card}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>2) GIF overlay</div>
          <input type="file" accept="image/gif" onChange={(e) => setGifFile(e.target.files?.[0] ?? null)} />
          {gifFile && <div style={small}>{gifFile.name}</div>}
        </label>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={run}
            disabled={!canRun}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: canRun ? "pointer" : "not-allowed",
              background: canRun ? "white" : "#f6f6f6",
              fontWeight: 600
            }}
          >
            Genera video
          </button>

          <StatusLine status={status} />
        </div>

        {status.type === "processing" && (
          <div style={card}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Progress</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <progress value={Math.round(status.progress * 100)} max={100} style={{ width: "100%" }} />
              <div style={{ width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {Math.round(status.progress * 100)}%
              </div>
            </div>
            {status.log && <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", opacity: 0.85, fontSize: 12 }}>{status.log}</pre>}
          </div>
        )}

        {status.type === "done" && (
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Pronto ✅</div>
            <a
              href={status.url}
              download={status.filename}
              style={{
                display: "inline-block",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                textDecoration: "none"
              }}
            >
              Scarica {status.filename}
            </a>

            <div style={{ marginTop: 12 }}>
              <video src={status.url} controls style={{ width: "100%", borderRadius: 12 }} />
            </div>
          </div>
        )}

        {status.type === "error" && (
          <div style={{ ...card, borderColor: "#f2b8b8", background: "#fff7f7" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Errore</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{status.message}</div>
          </div>
        )}
      </section>

      <footer style={{ marginTop: 28, opacity: 0.65, fontSize: 13 }}>
        Nota: video lunghi e/o 4K possono essere lenti su FFmpeg.wasm (browser) e consumare molta RAM.
      </footer>
    </main>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.type === "loading-ffmpeg") return <span style={{ opacity: 0.8 }}>Carico FFmpeg…</span>;
  if (status.type === "ready") return <span style={{ opacity: 0.8 }}>Pronto</span>;
  if (status.type === "processing") return <span style={{ opacity: 0.8 }}>Processo…</span>;
  if (status.type === "done") return <span style={{ opacity: 0.8 }}>Completato</span>;
  return <span style={{ opacity: 0.8 }}>Errore</span>;
}

const card: React.CSSProperties = {
  border: "1px solid #e7e7e7",
  borderRadius: 14,
  padding: 14,
  background: "white"
};

const small: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  opacity: 0.8
};

function safeName(name: string) {
  return name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 40);
}
