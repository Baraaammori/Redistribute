import { AlertTriangle, ExternalLink, RefreshCw, X } from "lucide-react";

interface Props {
  errorCode: string | null;
  errorMessage?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const ERROR_CONFIG: Record<string, {
  title: string;
  body: string;
  action?: { label: string; href?: string; onClick?: string };
  severity: "warning" | "error" | "info";
}> = {
  TIKTOK_APP_NOT_AUDITED: {
    severity: "warning",
    title: "TikTok App Not Audited",
    body: "Your TikTok developer app hasn't passed audit yet. Videos can only post to private accounts. Either submit your app for review at developers.tiktok.com, or ask your test user to set their TikTok account to Private in Settings → Privacy.",
    action: { label: "Open TikTok Developer Portal", href: "https://developers.tiktok.com" },
  },
  TIKTOK_TOKEN_EXPIRED: {
    severity: "error",
    title: "TikTok Session Expired",
    body: "Your TikTok access token has expired. Reconnect your TikTok account to continue posting.",
    action: { label: "Reconnect TikTok", onClick: "/dashboard/accounts" },
  },
  TIKTOK_SCOPE_MISSING: {
    severity: "error",
    title: "TikTok Permission Missing",
    body: "Your TikTok account is missing the video.publish permission. Disconnect and reconnect your TikTok account to re-authorize with the correct scopes.",
    action: { label: "Fix Permissions", onClick: "/dashboard/accounts" },
  },
};

const SEVERITY_STYLES = {
  warning: {
    bg: "rgba(240,201,74,0.08)",
    border: "rgba(240,201,74,0.25)",
    icon: "#F0C94A",
    title: "#F0C94A",
  },
  error: {
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
    icon: "#EF4444",
    title: "#EF4444",
  },
  info: {
    bg: "rgba(124,92,252,0.08)",
    border: "rgba(124,92,252,0.25)",
    icon: "#9B7EFF",
    title: "#9B7EFF",
  },
};

export function TikTokErrorBanner({ errorCode, errorMessage, onRetry, onDismiss }: Props) {
  if (!errorCode && !errorMessage) return null;

  const config = errorCode ? ERROR_CONFIG[errorCode] : null;
  const severity = config?.severity || "error";
  const styles = SEVERITY_STYLES[severity];

  return (
    <div style={{
      background: styles.bg,
      border: `1px solid ${styles.border}`,
      borderRadius: 12,
      padding: "14px 16px",
      marginBottom: 16,
      position: "relative",
    }}>
      {onDismiss && (
        <button onClick={onDismiss} style={{
          position: "absolute", top: 10, right: 10,
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.3)", padding: 4, display: "flex",
        }}>
          <X size={14} />
        </button>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <AlertTriangle size={16} color={styles.icon} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: styles.title, marginBottom: 4 }}>
            {config?.title || "TikTok Error"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: config?.action || onRetry ? 12 : 0 }}>
            {config?.body || errorMessage}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {config?.action && (
              config.action.href ? (
                <a
                  href={config.action.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 14px", background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100,
                    color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {config.action.label} <ExternalLink size={10} />
                </a>
              ) : (
                <a
                  href={config.action.onClick}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 14px", background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100,
                    color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {config.action.label}
                </a>
              )
            )}

            {onRetry && (
              <button onClick={onRetry} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 14px", background: "rgba(124,92,252,0.15)",
                border: "1px solid rgba(124,92,252,0.3)", borderRadius: 100,
                color: "#9B7EFF", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>
                <RefreshCw size={10} /> Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
