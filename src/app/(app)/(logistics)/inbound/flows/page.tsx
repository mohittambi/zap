import { redirect } from "next/navigation";

/** Process Flows is now a top-level module at `/flows`. */
export default function InboundFlowsRedirect(): never {
  redirect("/flows");
}
