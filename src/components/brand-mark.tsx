import Image from "next/image";

export function BrandMark() {
  return (
    <div className="brand-mark">
      <Image
        className="site-logo-image"
        src="/brand/main-logo-allgood.png"
        alt="My Pet Health — Guidance, Care, Wellbeing"
        width={1836}
        height={856}
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

export function AllGoodLogo() {
  return (
    <a className="allgood-header-logo" href="https://allgoodpetfood.co.nz" aria-label="Visit All Good Petfood">
      <Image
        className="allgood-logo-image"
        src="/brand/allgood.png"
        alt="All Good Petfood - love your pet? So do we!"
        width={367}
        height={128}
        sizes="(max-width: 800px) 118px, 164px"
        loading="eager"
      />
    </a>
  );
}
