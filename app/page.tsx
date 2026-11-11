const APK = '/manhwa-reader.apk';

const features = [
  ['🔎', 'Discover', 'Browse curated recommendations and search across multiple sources.'],
  ['📖', 'Online Reading', 'Smooth continuous vertical scroll with pinch and double-tap zoom.'],
  ['⬇️', 'Downloads', 'Save chapters to read offline whenever you like.'],
  ['🔖', 'Chapter Bookmarks', 'Bookmark a page and attach a note to remember where the hook lands.'],
  ['❤️', 'Favorites & Wishlist', 'Heart series you love and keep a wishlist of what to read next.'],
  ['🕘', 'Resume Reading', 'Recent history picks up exactly where you stopped.'],
  ['📁', 'Local Folders', 'Read your own PDF chapters from folders you choose.'],
  ['💾', 'Backup & Restore', 'Export your library and bookmarks, and bring them back anytime.'],
];

const steps = [
  'Download and install the APK on your Android device.',
  'Open the app and browse Home or Discover.',
  'Tap a series, then pick a chapter to start reading.',
  'Heart it, wishlist it, or bookmark a page with a note.',
  'Download chapters for offline reading.',
  'Add your own folders in Settings to read local PDFs.',
];

function DownloadButton() {
  return (
    <a className="btn primary" href={APK} download>
      ⬇ Download APK
    </a>
  );
}

export default function Home() {
  return (
    <>
      <div className="wrap">
        <nav>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" />
          Manhwa Reader
        </nav>

        <header className="hero">
          <div>
            <h1>
              Manhwa
              <br />
              <span>reader.</span>
            </h1>
            <p className="tag">Read anywhere, even offline</p>
            <p className="sub">
              Browse, read online, download and bookmark your favorite manhwa and manga, all in one clean Android app.
            </p>
            <div className="btns">
              <DownloadButton />
              <a className="btn ghost" href="#how">
                How it works
              </a>
            </div>
            <p className="note">Android only · Free · If prompted, allow installs from this source.</p>
          </div>
          <div className="phone" aria-hidden="true">
            <div className="bar">Manhwa Reader</div>
            <div className="tabs">
              <div className="on">Home</div>
              <div>Favorites</div>
              <div>Recent</div>
            </div>
            <div className="grid">
              {Array.from({ length: 6 }, (_, i) => (
                <div className="cover" key={i} />
              ))}
            </div>
          </div>
        </header>

        <section id="features">
          <h2>Features</h2>
          <div className="features">
            {features.map(([icon, title, text]) => (
              <div className="f" key={title}>
                <div className="ic">{icon}</div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how">
          <h2>How to Use</h2>
          <ol>
            {steps.map((s, i) => (
              <li key={s}>
                <b>{i + 1}</b>
                {s}
              </li>
            ))}
          </ol>
          <div className="cta">
            <DownloadButton />
          </div>
        </section>
      </div>
      <footer>
        © 2026 Manhwa Reader. All rights reserved.
        <br />
        Not affiliated with any manhwa publisher or source.
      </footer>
    </>
  );
}
