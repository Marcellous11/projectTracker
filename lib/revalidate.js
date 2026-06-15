import { revalidatePath } from "next/cache";

export function revalidateProjectMetaViews(segments) {
  revalidatePath("/");
  if (segments?.length) {
    revalidatePath(`/p/${segments.map(encodeURIComponent).join("/")}`);
  }
}
