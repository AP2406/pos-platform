import { SolutionPage } from "../solution-page";
import { SOLUTIONS } from "../solution-content";
import { pageMetadata } from "../design";
const content = SOLUTIONS.find((page) => page.path === "/pos-costs")!;
export const metadata = pageMetadata(
  content.eyebrow,
  content.description,
  content.path,
);
export default function Page() {
  return <SolutionPage content={content} />;
}
