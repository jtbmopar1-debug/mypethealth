import Image from "next/image";

export function BrandMark() {
  return (
    <div className="brand-mark">
      <Image
        className="site-logo-image"
        src="/brand/main-logo.png"
        alt="My Pet Health — Guidance, Care, Wellbeing"
        width={950}
        height={443}
        sizes="224px"
        loading="eager"
      />
    </div>
  );
}

export function BuddyLogo() {
  return (
    <div className="buddy-logo">
      <Image
        className="brand-logo-image"
        src="/brand/buddy-logo.png"
        alt="Buddy — My Pet Health Guide"
        width={1536}
        height={1024}
        sizes="92px"
        loading="eager"
      />
    </div>
  );
}
