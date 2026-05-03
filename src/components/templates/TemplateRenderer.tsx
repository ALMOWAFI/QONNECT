import { TechTemplate } from "./TechTemplate";
import { MedTemplate } from "./MedTemplate";
import { BusinessTemplate } from "./BusinessTemplate";
import type { TemplateData } from "./TechTemplate";

export type { TemplateData };

export function TemplateRenderer({ data }: { data: TemplateData }) {
  switch (data.edition) {
    case "tech":
      return <TechTemplate data={data} />;
    case "medical":
      return <MedTemplate data={data} />;
    default:
      return <BusinessTemplate data={data} />;
  }
}
