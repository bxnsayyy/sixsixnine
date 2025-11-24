// -------------------------------------------------------------
// CONFIG DATI
// -------------------------------------------------------------

// ID del tuo Google Sheet
const SHEET_ID = "1gDyVQ3bpzlY8EjGtr7KClyn3x5ZPU9sQJYkYclNZIOE";

// oggetto che conterrà gli artisti
let ARTISTS = {};

// immagine di sfondo per il movimento
const bgImage = document.querySelector(".bg-image");

// -------------------------------------------------------------
// AVVIO
// -------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  main();
});

async function main() {
  await initData();              // carica JSON + Sheet

  initCloudRandomSpeed();
  initArtistsClick();
  initPopup();
  initMotionToggle();
  initMenuPopup();
}

// -------------------------------------------------------------
// CARICAMENTO DATI (JSON + GOOGLE SHEET)
// -------------------------------------------------------------

// cover da Spotify via oEmbed
async function fetchSpotifyCover(spotifyUrl) {
  if (!spotifyUrl) return null;
  try {
    const apiUrl = "https://open.spotify.com/oembed?url=" + spotifyUrl;
    const res = await fetch(apiUrl);
    const data = await res.json();
    return data.thumbnail_url || null;
  } catch (e) {
    console.error("Errore fetchSpotifyCover:", e);
    return null;
  }
}

async function initData() {
  try {
    // 1) dati statici (name/bio/social) da releases.json
    const res = await fetch("releases.json");
    ARTISTS = await res.json();

    // 2) releases dinamiche dal Google Sheet
    const sheetReleases = await loadReleasesFromSheet();

    // 3) unisci releases agli artisti
    for (const key in sheetReleases) {
      if (ARTISTS[key]) {
        ARTISTS[key].releases = sheetReleases[key];
      }
    }

    console.log("ARTISTS FINAL:", ARTISTS);
  } catch (err) {
    console.error("Errore initData:", err);
  }
}

// legge il foglio:
// artist_key | title | type | isrc | upc | featurefm | spotify_link | release_date
async function loadReleasesFromSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

  const res = await fetch(url);
  const text = await res.text();

  const json = JSON.parse(text.substring(47, text.length - 2));
  const rows = json.table.rows || [];

  const releasesByArtist = {};

  for (const r of rows) {
    const c = r.c.map((x) => (x ? x.v : ""));

    const [
      artistKey,
      title,
      type,
      isrc,
      upc,
      featurefm,
      spotifyLink,
      releaseDate
    ] = c;

    if (!artistKey || !title) continue;

    // cover da Spotify se c'è il link
    let cover = null;
    if (spotifyLink) {
      cover = await fetchSpotifyCover(spotifyLink);
    }

    if (!releasesByArtist[artistKey]) {
      releasesByArtist[artistKey] = [];
    }

    releasesByArtist[artistKey].push({
      title,
      type,
      isrc,
      upc,
      featurefm,
      spotify: spotifyLink,
      cover,
      date: releaseDate
    });
  }

  // ordina per data (più recente in alto)
  Object.values(releasesByArtist).forEach((list) => {
    list.sort((a, b) => {
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      return db - da;
    });
  });

  return releasesByArtist;
}

// -------------------------------------------------------------
// NUVOLI
// -------------------------------------------------------------

function initCloudRandomSpeed() {
  const clouds = document.querySelectorAll(".cloud, .cloud-foreground");
  clouds.forEach((cloud) => {
    const base = 18000;
    const random = Math.random() * 8000;
    cloud.style.animationDuration = base + random + "ms";
  });
}

// -------------------------------------------------------------
// CLICK SUGLI ARTISTI
// -------------------------------------------------------------

let popupBackdrop, popupWindow;

function initArtistsClick() {
  const cards = document.querySelectorAll(".artist-card");
  popupBackdrop = document.getElementById("artist-popup");
  popupWindow = document.getElementById("popup-window");

  if (!cards.length || !popupBackdrop || !popupWindow) return;

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const artistKey = card.dataset.artist;
      openPopup(artistKey);
    });
  });
}

// -------------------------------------------------------------
// POPUP
// -------------------------------------------------------------

function initPopup() {
  popupBackdrop = document.getElementById("artist-popup");
  popupWindow = document.getElementById("popup-window");
  if (!popupBackdrop || !popupWindow) return;

  const closeBtn = document.getElementById("popup-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", closePopup);
  }

  popupBackdrop.addEventListener("click", (e) => {
    if (e.target === popupBackdrop) {
      closePopup();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopup();
  });
}

function openPopup(artistKey) {
  const artist = ARTISTS[artistKey];
  if (!artist) return;

  const bigNameEl  = document.getElementById("popup-artist-name-big");
  const bioEl      = document.getElementById("popup-artist-bio");
  const socialBox  = document.getElementById("popup-artist-social");
  const gridEl     = document.getElementById("popup-grid");

  // NOME GRANDE
  if (bigNameEl) {
    bigNameEl.textContent = artist.name || "";
  }

  // BIO
  if (bioEl) {
    bioEl.textContent = artist.bio || "";
  }

  // SOCIALS
  if (socialBox) {
    socialBox.innerHTML = "";
    if (artist.social) {
      Object.entries(artist.social).forEach(([platform, url]) => {
        if (!url) return;
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = platform.toUpperCase();
        socialBox.appendChild(link);
      });
    }
  }

  // GRID MUSICA
  if (!gridEl) return;
  gridEl.innerHTML = "";

  (artist.releases || []).forEach((rel) => {
    const card = document.createElement("a");
    card.className = "music-card";

    // feature.fm prioritaria
    if (rel.featurefm) {
      card.href = rel.featurefm;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    } else if (rel.spotify) {
      card.href = rel.spotify;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    } else {
      card.href = "#";
    }

    const cover = document.createElement("div");
    cover.className = "music-cover";
    const img = document.createElement("img");
    img.src = rel.cover || "";
    img.alt = rel.title || "";
    cover.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "music-meta";

    const type = document.createElement("div");
    type.className = "music-type";
    type.textContent = rel.type || "";

    const title = document.createElement("div");
    title.className = "music-title";
    title.textContent = rel.title || "";

    meta.appendChild(type);
    meta.appendChild(title);

    card.appendChild(cover);
    card.appendChild(meta);

    gridEl.appendChild(card);
  });

  popupBackdrop.classList.add("open");
}

function closePopup() {
  if (!popupBackdrop) return;
  popupBackdrop.classList.remove("open");
}

// -------------------------------------------------------------
// MOVIMENTO SFONDO: mouse + telefono
// -------------------------------------------------------------

let motionEnabled = false;

// mouse (desktop)
document.addEventListener("mousemove", (e) => {
  if (!bgImage || motionEnabled) return;

  const x = (e.clientX / window.innerWidth - 0.5) * 10;
  const y = (e.clientY / window.innerHeight - 0.5) * 10;

  bgImage.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
});

// phone motion
window.addEventListener("deviceorientation", (e) => {
  if (!motionEnabled || !bgImage) return;

  const x = e.gamma;
  const y = e.beta;

  const moveX = (x / 30) * 10;
  const moveY = (y / 30) * 10;

  bgImage.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.05)`;
});

// toggle
function initMotionToggle() {
  const motionToggleBtn = document.getElementById("motion-toggle");
  if (!motionToggleBtn) return;

  motionToggleBtn.addEventListener("click", async () => {
    if (!motionEnabled) {
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
      ) {
        try {
          const response = await DeviceMotionEvent.requestPermission();
          if (response === "granted") {
            motionEnabled = true;
            motionToggleBtn.textContent = "MOTION: ON";
          }
        } catch (err) {
          alert("Per usare il movimento bisogna dare il permesso.");
        }
      } else {
        motionEnabled = true;
        motionToggleBtn.textContent = "MOTION: ON";
      }
    } else {
      motionEnabled = false;
      motionToggleBtn.textContent = "MOTION: OFF";
      bgImage.style.transform = "scale(1.05)";
    }
  });
}

// -------------------------------------------------------------
// MENU LATERALE
// -------------------------------------------------------------

function initMenuPopup() {
  const menuBtn   = document.querySelector(".menu-button");
  const menuPopup = document.getElementById("menu-popup");
  const menuClose = document.getElementById("menu-close");

  if (!menuBtn || !menuPopup || !menuClose) return;

  menuBtn.addEventListener("click", () => {
    menuPopup.classList.add("open");
  });

  menuClose.addEventListener("click", () => {
    menuPopup.classList.remove("open");
  });

  menuPopup.addEventListener("click", (e) => {
    if (e.target === menuPopup) {
      menuPopup.classList.remove("open");
    }
  });
}
