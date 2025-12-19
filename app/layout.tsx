export const metadata = {
  title: "Video + GIF Multiply",
  description: "Upload video + gif, export mp4 con blend multiply"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, background: "#fafafa" }}>{children}</body>
    </html>
  );
}
