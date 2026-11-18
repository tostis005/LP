import Link from "next/link";
export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={"brand" + (light ? " brand-light" : "")} aria-label="LP inicio">
    <span className="brand-symbol">l<span>.</span></span><span className="brand-name">loyal<span>ly</span></span>
  </Link>;
}
