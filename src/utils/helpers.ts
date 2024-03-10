import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cls = (...input: ClassValue[]) => twMerge(clsx(input));
