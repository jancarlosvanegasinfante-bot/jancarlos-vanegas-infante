import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getProxiedImageUrl(url?: string): string {
  if (!url) return "/images/logo.jpeg";
  if (url.startsWith("/src/assets/images/")) {
    url = url.replace("/src/assets/images/", "/images/");
  }
  if (url.startsWith("/images/")) {
    return encodeURI(url);
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (url.includes("ibb.co") || url.includes("mlstatic.com") || url.includes("cloudfront.net")) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
  }
  return url;
}

