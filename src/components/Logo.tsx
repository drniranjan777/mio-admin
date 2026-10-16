import logoUrl from '../assets/mio-logo.png';

/** Width / height of assets/mio-logo.png (600 × 162, the app logo resized). */
const ASPECT = 600 / 162;

/** Full Mio Doctors logo (mark, name, tagline): keeps its proportions, never cropped. */
export function Logo({ width }: { width: number }) {
  return <img className="logo" src={logoUrl} alt="Mio Doctors" width={width} height={Math.round(width / ASPECT)} />;
}
