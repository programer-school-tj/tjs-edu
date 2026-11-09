import React, { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setMessage("TJS Edu дар дастгоҳ насб шуд.");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setMessage(choice.outcome === "accepted"
      ? "Насби TJS Edu оғоз шуд."
      : "Насб бекор карда шуд. Баъдтар метавонед аз менюи браузер насб кунед.");
  };

  if (installed) return <div role="status" style={bannerStyle}>✓ {message}</div>;
  if (dismissed) return null;

  return (
    <aside style={bannerStyle} aria-live="polite">
      <div style={{ flex: 1 }}>
        <strong>Насб кардани TJS Edu</strong>
        <div style={{ fontSize: 13, marginTop: 3 }}>{message || "Барномаро ба экрани телефон ё мизи кории Windows илова кунед."}</div>
        {helpOpen && <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
          Android: дар Chrome менюи ⋮-ро кушоед ва «Install app» ё «Add to Home screen»-ро интихоб кунед.
          <br />Windows: дар Microsoft Edge менюи ⋯-ро кушоед, баъд «Apps» → «Install this site as an app».
        </div>}
      </div>
      {installEvent
        ? <button type="button" onClick={() => void install()} style={buttonStyle}>Насб кардан</button>
        : <button type="button" onClick={() => setHelpOpen((open) => !open)} style={buttonStyle}>{helpOpen ? "Пинҳон кардан" : "Роҳнамо"}</button>}
      <button type="button" aria-label="Пӯшидан" onClick={() => { setMessage(""); setHelpOpen(false); setDismissed(true); }} style={closeStyle}>×</button>
    </aside>
  );
}

const bannerStyle: React.CSSProperties = {
  position: "fixed", zIndex: 1000, left: 12, right: 12, bottom: 12,
  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
  borderRadius: 14, background: "#173b3a", color: "#fff",
  boxShadow: "0 8px 28px rgba(0,0,0,.22)", fontFamily: "Arial, sans-serif",
};
const buttonStyle: React.CSSProperties = {
  border: 0, borderRadius: 9, padding: "10px 13px", background: "#f2c14e",
  color: "#173b3a", fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer",
};
const closeStyle: React.CSSProperties = {
  border: 0, background: "transparent", color: "#fff", fontSize: 22, cursor: "pointer",
};