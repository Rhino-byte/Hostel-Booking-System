/**
 * Single source for public brochure content.
 * Swap image files under public/images/marketing/ without changing keys.
 */

export const siteContent = {
  brand: "St. Clare's Girls Hostel",
  tagline: "Four Residences. One Family.",
  phones: [
    { display: "0700 760 280", href: "tel:+254700760280" },
    { display: "0712 058 858", href: "tel:+254712058858" },
  ],
  whatsapp: {
    display: "0712 058 858",
    /** International format for wa.me (no + or spaces) */
    e164: "254712058858",
  },
  email: "st.clarehostel@gmail.com",
  landmark: "Bogani East Road and 300m from CUEA Gate B Campus",
  mapsUrl: "https://maps.app.goo.gl/zurCF6ipbaQuKjjW6",
  mapsEmbedSrc:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.70122896929!2d36.75586817480365!3d-1.355862198631301!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f053f5e07ede5%3A0x11baf58b316e26f5!2sSt%20Clares%20Girls%20Hostels!5e0!3m2!1sen!2ske!4v1785742639759!5m2!1sen!2ske",
  officeHours: "Mon–Fri, 8:00am – 5:00pm",
  paymentsNote: "Mobile money Pay Bill or bank deposit",
} as const;

export type SiteImageKey =
  | "campusHero"
  | "groundsDusk"
  | "courtyardQuiet";

export const siteImages: Record<
  SiteImageKey,
  { src: string; alt: string }
> = {
  campusHero: {
    src: "/images/marketing/campus-path.png",
    alt: "Stone residence buildings and garden path at St. Clare's Girls Hostels",
  },
  groundsDusk: {
    src: "/images/marketing/grounds-dusk.png",
    alt: "Evening light over hostel grounds and gardens",
  },
  courtyardQuiet: {
    src: "/images/marketing/courtyard-quiet.png",
    alt: "Quiet courtyard garden beside stone hostel buildings",
  },
};

/** Optional per-residence marketing image keys until real room photos exist */
export const residenceImageKeys: Record<string, SiteImageKey> = {
  SC: "campusHero",
  B: "courtyardQuiet",
  C: "groundsDusk",
  A: "courtyardQuiet",
  CL: "groundsDusk",
};
