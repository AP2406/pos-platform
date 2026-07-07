// Section 2: this segment sets its own openGraph, which replaces the parent's file
// image — so re-export the shared card here to keep og:image on this page.
export { default, alt, size, contentType } from "../opengraph-image";
