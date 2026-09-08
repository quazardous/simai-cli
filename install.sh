#!/usr/bin/env sh
# Install what simcli hands off to.
#
# simcli itself needs nothing at runtime — Node builds it and Node runs
# it. But three of its verbs end somewhere else: a tmux pane it did not
# open, a GIF it cannot draw, a video it cannot encode. This installs
# those, and nothing else.
#
# IT PRINTS WHAT IT WILL DO AND ASKS FIRST. A script that installs system
# packages without saying which, under sudo, is not a convenience.
#
#   ./install.sh          ask, then install what is missing
#   ./install.sh --check   say what is missing and stop
#   ./install.sh --yes     install without asking
set -eu

AGG_VERSION=1.9.0
check_only=0
assume_yes=0
for arg in "$@"; do
  case "$arg" in
    --check) check_only=1 ;;
    --yes|-y) assume_yes=1 ;;
    *) echo "usage: $0 [--check] [--yes]" >&2; exit 2 ;;
  esac
done

have() { command -v "$1" >/dev/null 2>&1; }

# The package manager this machine actually has. Naming the wrong one is
# worse than saying nothing, because it gets tried.
PM=""
for pm in dnf apt-get pacman zypper brew; do have "$pm" && PM="$pm" && break; done

install_pkg() {
  case "$PM" in
    dnf)     sudo dnf install -y "$1" ;;
    apt-get) sudo apt-get install -y "$1" ;;
    pacman)  sudo pacman -S --noconfirm "$1" ;;
    zypper)  sudo zypper install -y "$1" ;;
    brew)    brew install "$1" ;;
    *) echo "  ! no known package manager — install $1 yourself" >&2; return 1 ;;
  esac
}

# agg is NOT the crates.io crate of that name: that one is an unrelated
# library at 0.1.0 with no binary, and `cargo install agg` fails with
# "there is nothing to install", which reads like a broken toolchain
# rather than a wrong name. asciinema's agg lives only in its own
# repository and publishes prebuilt binaries — used here, so this needs
# no Rust toolchain.
install_agg() {
  arch=$(uname -m)
  os=$(uname -s)
  case "$os" in
    Linux)  target="$arch-unknown-linux-gnu" ;;
    Darwin) target="$arch-apple-darwin" ;;
    *) echo "  ! unknown system $os — see https://github.com/asciinema/agg/releases" >&2; return 1 ;;
  esac
  url="https://github.com/asciinema/agg/releases/download/v$AGG_VERSION/agg-$target"
  dest="${HOME}/.local/bin"
  mkdir -p "$dest"
  echo "  fetching $url"
  curl -fsSL -o "$dest/agg" "$url"
  chmod +x "$dest/agg"
  echo "  installed → $dest/agg"
  have agg || echo "  ! $dest is not on your PATH" >&2
}

missing=""
have tmux      || missing="$missing tmux"
have agg       || missing="$missing agg"
have asciinema || missing="$missing asciinema"
have ffmpeg    || missing="$missing ffmpeg"

if [ -z "$missing" ]; then
  echo "Everything simcli hands off to is already here."
  exit 0
fi

echo "simcli needs nothing to run. These are for what it hands off to:"
echo
for m in $missing; do
  case "$m" in
    tmux)      echo "  tmux       simcli capture — reading a real client's pane" ;;
    agg)       echo "  agg        turning a .cast into a GIF   (v$AGG_VERSION, prebuilt)" ;;
    asciinema) echo "  asciinema  playing or sharing a .cast" ;;
    ffmpeg)    echo "  ffmpeg     turning that GIF into an MP4" ;;
  esac
done
echo
[ "$check_only" = 1 ] && exit 1

if [ "$assume_yes" = 0 ]; then
  printf "Install these%s? [y/N] " "${PM:+ with $PM}"
  read -r answer
  case "$answer" in [yY]*) ;; *) echo "nothing done."; exit 1 ;; esac
fi

for m in $missing; do
  echo "→ $m"
  if [ "$m" = agg ]; then install_agg; else install_pkg "$m"; fi
done

echo
echo "done. \`simcli tools\` re-checks at any time."
