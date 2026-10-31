import { redirect } from "next/navigation";

/**
 * The former standalone Capacity screen has been retired from the
 * CORTEX financial-institution workspace. Existing bookmarks go to the
 * authoritative, permission-checked destination without showing a
 * second prototype surface. No backend records are removed.
 */
export default function RetiredCapacityPage() {
  redirect("/value-intelligence");
}
