#!/usr/bin/env bash
# Apex Terminal — Infrastructure Setup Script
# Installs and starts the agent orchestrator + Cloudflare tunnel as systemd services.
# Run as root (or with sudo): sudo bash infra/install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APEX_USER="${SUDO_USER:-aarav}"

echo "==> Project root: $PROJECT_ROOT"
echo "==> Service user: $APEX_USER"

# ── 1. Copy systemd unit files ───────────────────────────────────────────────
echo "==> Installing systemd unit files..."
cp "$SCRIPT_DIR/apex-agents.service"     /etc/systemd/system/apex-agents.service
cp "$SCRIPT_DIR/cloudflared-apex.service" /etc/systemd/system/cloudflared-apex.service

systemctl daemon-reload
echo "   ✓ daemon-reload"

# ── 2. Enable + start apex-agents ────────────────────────────────────────────
echo "==> Enabling apex-agents.service..."
systemctl enable apex-agents
systemctl restart apex-agents
echo "   ✓ apex-agents running"

# ── 3. Optional: Cloudflare tunnel ───────────────────────────────────────────
# Only start if a cloudflared config exists with a real tunnel UUID
CFGFILE="/home/$APEX_USER/.cloudflared/config.yml"
if [ -f "$CFGFILE" ] && ! grep -q "TUNNEL_UUID_HERE" "$CFGFILE"; then
    echo "==> Cloudflared config found — enabling tunnel service..."
    systemctl enable cloudflared-apex
    systemctl restart cloudflared-apex
    echo "   ✓ cloudflared-apex running"
else
    echo "==> Cloudflare tunnel: config not configured yet."
    echo "   Run the following to set up a named tunnel:"
    echo "     cloudflared tunnel login"
    echo "     cloudflared tunnel create apex-terminal"
    echo "     # fill in TUNNEL_UUID_HERE in infra/cloudflared-config.yml"
    echo "     cp infra/cloudflared-config.yml ~/.cloudflared/config.yml"
    echo "     # then: sudo systemctl enable --now cloudflared-apex"
    echo ""
    echo "   For a quick ephemeral tunnel (no account):"
    echo "     cloudflared tunnel --url http://localhost:8000"
fi

# ── 4. Status summary ─────────────────────────────────────────────────────────
echo ""
echo "==> Status:"
systemctl status apex-agents --no-pager --lines=3 || true
echo ""
echo "==> Logs:"
echo "   journalctl -u apex-agents -f"
echo "   journalctl -u cloudflared-apex -f"
