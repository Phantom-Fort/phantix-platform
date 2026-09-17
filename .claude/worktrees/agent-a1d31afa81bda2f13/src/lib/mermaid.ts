// Renders diagram sources used in the platform how-to guides. Every diagram in
// this app's doc set is a `flowchart TD/LR` block, drawn by the native
// dependency-free renderer --- so unlike Command Centre, this app does not
// carry the `mermaid` npm package for other diagram types.
import { isFlowchart, renderFlowSvg } from "./flowChart";

/** Render a diagram source string to an SVG string. Returns "" for diagram
 *  types other than `flowchart` (none exist in this app's docs today). */
export async function renderMermaid(code: string): Promise<string> {
  if (isFlowchart(code)) return renderFlowSvg(code);
  return "";
}
