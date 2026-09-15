import { GuideArticle, guideMetadata } from "../guide-layout";
const slug = "card-processing-costs";
export const metadata = guideMetadata(slug);
export default function Page() {
  return <GuideArticle slug={slug} />;
}
