import type { Metadata } from "next";
import { NewExamWizard } from "./wizard";

export const metadata: Metadata = { title: "Nytt prov" };

export default function NewExamPage() {
  return <NewExamWizard />;
}
