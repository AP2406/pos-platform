import { GuideArticle, guideMetadata } from "../guide-layout";
const slug = "how-to-read-your-merchant-statement";
export const metadata = guideMetadata(slug);
export default function Page() {
  return <GuideArticle slug={slug} />;
}
