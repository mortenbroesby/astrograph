import { analyzeFileContent } from "../file-analysis.ts";
import type { FileAnalysisTaskInput } from "../file-analysis.ts";

export default function runAnalyzeFileWorker(input: FileAnalysisTaskInput) {
  return analyzeFileContent(input);
}
