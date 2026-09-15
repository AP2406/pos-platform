import { GuideArticle, guideMetadata } from "../guide-layout";
const slug = "what-is-a-junk-fee-on-a-merchant-account";
export const metadata = guideMetadata(slug);
export default function Page() {
  return <GuideArticle slug={slug} />;
}
