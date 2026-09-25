import { env } from "cloudflare:workers";
import { Policy } from "@/components/policies";
export default function Page() {
  return <Policy kind="terms" contact={env.CONTACT_EMAIL} />;
}
