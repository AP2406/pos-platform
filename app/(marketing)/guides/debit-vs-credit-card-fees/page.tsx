import { GuideArticle, guideMetadata } from "../guide-layout";
const slug = "debit-vs-credit-card-fees";
export const metadata = guideMetadata(slug);
export default function Page() {
  return <GuideArticle slug={slug} />;
}
