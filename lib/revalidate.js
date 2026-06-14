import { revalidatePath } from "next/cache";

export function revalidateClientViews() {
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/time");
}

export function revalidateProjectMetaViews(segments) {
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/time");
  if (segments?.length) {
    revalidatePath(`/p/${segments.map(encodeURIComponent).join("/")}`);
  }
}

export function revalidateTimeViews(segments) {
  revalidatePath("/");
  revalidatePath("/time");
  if (segments?.length) {
    revalidatePath(`/p/${segments.map(encodeURIComponent).join("/")}`);
  }
}
